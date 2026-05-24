import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandStatus,
    Player,
    system,
    world,
    type CustomCommandOrigin,
    type CustomCommandResult,
    type PlayerInteractWithBlockAfterEvent,
    type StartupEvent,
} from "@minecraft/server";
import { Link } from "../../link.js";
import { Zones } from "../../zones.js";
import { requestZoneDraftSave } from "../../zones/draft.js";
import {
    ZoneEditorSession,
    type ZoneEditorAction,
    type ZoneEditorActionResult,
    type ZoneEditorPosition,
} from "./editor-core.js";

const ZONE_EDITOR_READY_EVENT = "bebe.zones.editor.ready";
const ZONE_EDITOR_READY_KEY = "bebe.zones.editor";

export type ZoneEditorInstallOptions = {
    /**
     * Emits the editor-ready snapshot when the editor is installed.
     *
     * Defaults to true so tooling can discover that the injected editor code is
     * present without relying on console output.
     */
    readonly announce?: boolean;
    /**
     * Registers the zone editor custom command.
     *
     * Defaults to true.
     */
    readonly enableCommands?: boolean;
    /**
     * Command namespace used for the zone editor command.
     *
     * Defaults to `"bebe"` for direct use, while project tooling can pass the
     * project namespace so Bedrock's custom command registry sees one namespace.
     */
    readonly commandNamespace?: string;
    /**
     * Permission level used for the custom command.
     *
     * Defaults to `GameDirectors` for direct installs. Tooling may lower this
     * in development-only pipelines where the editor is not packaged.
     */
    readonly commandPermissionLevel?: CommandPermissionLevel;
    /**
     * Enables block-interaction editor tools.
     *
     * Defaults to false until the interaction workflow is explicitly installed.
     */
    readonly enableInteractions?: boolean;
};

export type ZoneEditorCommandContext = {
    readonly dimension: string;
    readonly position: ZoneEditorPosition;
};

export type ZoneEditorInteractionMode =
    | { readonly mode: "boxStart"; readonly id: string }
    | { readonly mode: "boxEnd"; readonly id: string }
    | { readonly mode: "polygonAdd" };

export type ZoneEditorCommandParseResult =
    | ZoneEditorAction
    | {
          readonly kind: "selectTool";
          readonly mode: ZoneEditorInteractionMode | undefined;
      }
    | { readonly ok: false; readonly message: string };

export function createZoneEditorInteractionAction(
    mode: ZoneEditorInteractionMode,
    position: ZoneEditorPosition,
): ZoneEditorAction {
    switch (mode.mode) {
        case "boxStart":
            return { kind: "boxStart", id: mode.id, position };
        case "boxEnd":
            return { kind: "boxEnd", id: mode.id, position };
        case "polygonAdd":
            return { kind: "polygonAdd", position };
    }
}

export function parseZoneEditorCommand(
    context: ZoneEditorCommandContext,
    args: readonly unknown[],
): ZoneEditorCommandParseResult {
    const [actionInput, idInput, aInput, bInput] = args;
    const action = String(actionInput ?? "").trim();
    const id = typeof idInput === "string" ? idInput.trim() : "";

    switch (action) {
        case "status":
            return { kind: "status" };
        case "list":
            return { kind: "list", dimension: context.dimension };
        case "block":
            return (
                requireId(action, id) ?? {
                    kind: "block",
                    id,
                    position: context.position,
                }
            );
        case "box-start":
            return (
                requireId(action, id) ?? {
                    kind: "boxStart",
                    id,
                    position: context.position,
                }
            );
        case "box-end":
            return (
                requireId(action, id) ?? {
                    kind: "boxEnd",
                    id,
                    position: context.position,
                }
            );
        case "polygon-start": {
            const idError = requireId(action, id);
            if (idError) {
                return idError;
            }

            const yMin = Number(aInput);
            const yMax = Number(bInput);
            if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
                return {
                    ok: false,
                    message:
                        'Action "polygon-start" requires numeric y min and y max.',
                };
            }

            return {
                kind: "polygonStart",
                id,
                dimension: context.dimension,
                yMin,
                yMax,
            };
        }
        case "polygon-add":
            return {
                kind: "polygonAdd",
                position: context.position,
            };
        case "polygon-finish":
            return { kind: "polygonFinish" };
        case "delete":
            return (
                requireId(action, id) ?? {
                    kind: "delete",
                    id,
                    dimension: context.dimension,
                }
            );
        case "discard":
            return { kind: "discard" };
        case "save":
            return { kind: "save" };
        case "tool":
            return parseZoneEditorTool(id, aInput);
        default:
            return {
                ok: false,
                message: `Unknown zone editor action "${action}".`,
            };
    }
}

/**
 * Installs the dev-time Bebe zone editor runtime.
 *
 * This internal entry point is injected by `blr` when the active pipeline asks
 * for the editor. Gameplay projects should not import it directly.
 */
export function installZoneEditor(
    options: ZoneEditorInstallOptions = {},
): () => void {
    const session = new ZoneEditorSession({
        initialPack: Zones.toPack(),
    });
    const interactionModes = new Map<string, ZoneEditorInteractionMode>();
    let startupCallback: ((event: StartupEvent) => void) | undefined;
    let interactCallback:
        | ((event: PlayerInteractWithBlockAfterEvent) => void)
        | undefined;

    if (options.announce !== false) {
        Link.snapshot(
            ZONE_EDITOR_READY_EVENT,
            {
                version: 1,
            },
            {
                key: ZONE_EDITOR_READY_KEY,
            },
        );
    }

    if (options.enableCommands !== false) {
        const commandNamespace = normalizeCommandNamespace(
            options.commandNamespace ?? "bebe",
        );
        startupCallback = system.beforeEvents.startup.subscribe((event) => {
            event.customCommandRegistry.registerCommand(
                {
                    name: `${commandNamespace}:zone`,
                    description: "Edit Bebe zones in a dev world.",
                    permissionLevel:
                        options.commandPermissionLevel ??
                        CommandPermissionLevel.GameDirectors,
                    cheatsRequired: true,
                    mandatoryParameters: [
                        {
                            name: "action",
                            type: CustomCommandParamType.String,
                        },
                    ],
                    optionalParameters: [
                        { name: "id", type: CustomCommandParamType.String },
                        { name: "a", type: CustomCommandParamType.String },
                        { name: "b", type: CustomCommandParamType.String },
                    ],
                },
                (origin, ...args) =>
                    handleZoneEditorCommand(
                        session,
                        interactionModes,
                        origin,
                        args,
                    ),
            );
        });
    }

    if (options.enableInteractions !== false) {
        interactCallback = world.afterEvents.playerInteractWithBlock.subscribe(
            (event) => {
                const mode = interactionModes.get(event.player.id);
                if (!mode) {
                    return;
                }

                const block = event.block;
                zoneEditorResultToCommandResult(
                    session.handle(
                        createZoneEditorInteractionAction(mode, {
                            dimension: block.dimension.id,
                            x: block.location.x,
                            y: block.location.y,
                            z: block.location.z,
                        }),
                    ),
                );
            },
        );
    }

    return () => {
        if (startupCallback) {
            system.beforeEvents.startup.unsubscribe(startupCallback);
        }
        if (interactCallback) {
            world.afterEvents.playerInteractWithBlock.unsubscribe(
                interactCallback,
            );
        }
        interactionModes.clear();
    };
}

function normalizeCommandNamespace(namespace: string): string {
    const normalized = namespace.trim();
    if (!/^[a-z0-9_]+$/u.test(normalized)) {
        throw new Error(
            `Zone editor command namespace must contain only lowercase letters, numbers, and underscores.`,
        );
    }

    return normalized;
}

function handleZoneEditorCommand(
    session: ZoneEditorSession,
    interactionModes: Map<string, ZoneEditorInteractionMode>,
    origin: CustomCommandOrigin,
    args: readonly unknown[],
): CustomCommandResult {
    const player = origin.sourceEntity;
    if (!(player instanceof Player)) {
        return {
            status: CustomCommandStatus.Failure,
            message: "Bebe zone editor commands must be run by a player.",
        };
    }

    const context: ZoneEditorCommandContext = {
        dimension: player.dimension.id,
        position: {
            dimension: player.dimension.id,
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y),
            z: Math.floor(player.location.z),
        },
    };
    const action = parseZoneEditorCommand(context, args);
    if (isZoneEditorCommandError(action)) {
        return {
            status: CustomCommandStatus.Failure,
            message: action.message,
        };
    }
    if (action.kind === "selectTool") {
        if (action.mode) {
            interactionModes.set(player.id, action.mode);
            return {
                status: CustomCommandStatus.Success,
                message: "Zone editor tool selected.",
            };
        }

        interactionModes.delete(player.id);
        return {
            status: CustomCommandStatus.Success,
            message: "Zone editor tool cleared.",
        };
    }

    return zoneEditorResultToCommandResult(session.handle(action));
}

function zoneEditorResultToCommandResult(
    result: ZoneEditorActionResult,
): CustomCommandResult {
    if (!result.ok) {
        return {
            status: CustomCommandStatus.Failure,
            message: result.message,
        };
    }
    if (result.previewPack) {
        Zones.load(result.previewPack);
    }
    if (result.savePack) {
        requestZoneDraftSave(result.savePack);
    }

    return {
        status: CustomCommandStatus.Success,
        message: result.message,
    };
}

function requireId(
    action: string,
    id: string,
): { readonly ok: false; readonly message: string } | undefined {
    return id.length === 0
        ? {
              ok: false,
              message: `Action "${action}" requires a zone id.`,
          }
        : undefined;
}

function isZoneEditorCommandError(
    result: ZoneEditorCommandParseResult,
): result is { readonly ok: false; readonly message: string } {
    return "ok" in result;
}

function parseZoneEditorTool(
    tool: string,
    idInput: unknown,
): ZoneEditorCommandParseResult {
    const id = typeof idInput === "string" ? idInput.trim() : "";

    switch (tool) {
        case "box-start":
            return (
                requireId("tool box-start", id) ?? {
                    kind: "selectTool",
                    mode: { mode: "boxStart", id },
                }
            );
        case "box-end":
            return (
                requireId("tool box-end", id) ?? {
                    kind: "selectTool",
                    mode: { mode: "boxEnd", id },
                }
            );
        case "polygon-add":
            return {
                kind: "selectTool",
                mode: { mode: "polygonAdd" },
            };
        case "clear":
            return {
                kind: "selectTool",
                mode: undefined,
            };
        default:
            return {
                ok: false,
                message: `Unknown zone editor tool "${tool}".`,
            };
    }
}
