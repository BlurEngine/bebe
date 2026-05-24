import { afterEach, describe, expect, it } from "vitest";
import {
    createZoneEditorInteractionAction,
    installZoneEditor,
    parseZoneEditorCommand,
    type ZoneEditorCommandContext,
} from "@blurengine/bebe/internal/zones/editor";
import {
    clearLinkTransport,
    installLinkTransport,
    type LinkEvent,
    type LinkEventTransport,
    type LinkInboundHandler,
} from "../src/link.js";
import {
    CommandPermissionLevel,
    minecraftMockControl,
} from "./support/minecraft-server.mock";

class FakeLinkTransport implements LinkEventTransport {
    readonly sent: LinkEvent[] = [];

    capabilities(): readonly string[] {
        return ["events"];
    }

    event(event: LinkEvent): void {
        this.sent.push(event);
    }

    isAvailable(capability?: string): boolean {
        return capability ? capability === "events" : true;
    }

    on(_kind: string, _handler: LinkInboundHandler): () => void {
        return () => {};
    }

    status() {
        return {
            available: true,
            capabilities: this.capabilities(),
        };
    }
}

describe("internal zone editor", () => {
    const commandContext: ZoneEditorCommandContext = {
        dimension: "overworld",
        position: { dimension: "overworld", x: 10, y: 64, z: -2 },
    };

    afterEach(() => {
        clearLinkTransport();
        minecraftMockControl.reset();
    });

    it("announces editor availability without requiring project code", () => {
        const transport = new FakeLinkTransport();
        clearLinkTransport();
        installLinkTransport(transport);

        expect(installZoneEditor()).toBeTypeOf("function");

        expect(transport.sent).toEqual([
            {
                kind: "bebe.zones.editor.ready",
                data: {
                    version: 1,
                },
                meta: {
                    retention: "latest",
                    retentionKey: "bebe.zones.editor",
                },
            },
        ]);
    });

    it("registers the editor command in the configured command namespace", () => {
        installZoneEditor({
            announce: false,
            commandNamespace: "demo_pack",
        } as Parameters<typeof installZoneEditor>[0] & {
            readonly commandNamespace: string;
        });

        minecraftMockControl.emitStartup();

        expect(
            minecraftMockControl.getCustomCommand("demo_pack:zone"),
        ).toBeTypeOf("object");
        expect(
            minecraftMockControl.getCustomCommand("demo_pack:zone")?.command
                .permissionLevel,
        ).toBe(CommandPermissionLevel.GameDirectors);
        expect(
            minecraftMockControl.getCustomCommand("bebe:zone"),
        ).toBeUndefined();
    });

    it("allows tooling to lower editor command permissions for dev sessions", () => {
        installZoneEditor({
            announce: false,
            commandNamespace: "demo_pack",
            commandPermissionLevel: CommandPermissionLevel.Any,
        });

        minecraftMockControl.emitStartup();

        expect(
            minecraftMockControl.getCustomCommand("demo_pack:zone")?.command
                .permissionLevel,
        ).toBe(CommandPermissionLevel.Any);
    });

    it("parses block commands from command arguments", () => {
        expect(
            parseZoneEditorCommand(commandContext, ["block", "town.spawn"]),
        ).toEqual({
            kind: "block",
            id: "town.spawn",
            position: commandContext.position,
        });
    });

    it("parses polygon-start y arguments as numbers", () => {
        expect(
            parseZoneEditorCommand(commandContext, [
                "polygon-start",
                "town.route",
                "60",
                "90",
            ]),
        ).toEqual({
            kind: "polygonStart",
            id: "town.route",
            dimension: "overworld",
            yMin: 60,
            yMax: 90,
        });
    });

    it("rejects missing zone ids with a friendly message", () => {
        expect(parseZoneEditorCommand(commandContext, ["block"])).toEqual({
            ok: false,
            message: 'Action "block" requires a zone id.',
        });
    });

    it("parses tool selection commands", () => {
        expect(
            parseZoneEditorCommand(commandContext, [
                "tool",
                "box-start",
                "town.market",
            ]),
        ).toEqual({
            kind: "selectTool",
            mode: {
                mode: "boxStart",
                id: "town.market",
            },
        });
        expect(
            parseZoneEditorCommand(commandContext, ["tool", "polygon-add"]),
        ).toEqual({
            kind: "selectTool",
            mode: {
                mode: "polygonAdd",
            },
        });
        expect(
            parseZoneEditorCommand(commandContext, ["tool", "clear"]),
        ).toEqual({
            kind: "selectTool",
            mode: undefined,
        });
    });

    it("maps a selected box start tool to the clicked block", () => {
        expect(
            createZoneEditorInteractionAction(
                {
                    mode: "boxStart",
                    id: "town.market",
                },
                {
                    dimension: "overworld",
                    x: 1,
                    y: 64,
                    z: 2,
                },
            ),
        ).toEqual({
            kind: "boxStart",
            id: "town.market",
            position: {
                dimension: "overworld",
                x: 1,
                y: 64,
                z: 2,
            },
        });
    });
});
