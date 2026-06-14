import type { Player } from "./minecraft-server.mock.js";

export type ActionFormButton = {
    readonly text: string;
};

export type ShownActionForm = {
    readonly body?: string;
    readonly buttons: readonly ActionFormButton[];
    readonly player: Player;
    readonly title?: string;
};

export type ActionFormResponse = {
    readonly canceled: boolean;
    readonly selection?: number;
};

const shownActionForms: ShownActionForm[] = [];
const queuedActionFormResponses: ActionFormResponse[] = [];

export class ActionFormData {
    #body: string | undefined;
    #buttons: ActionFormButton[] = [];
    #title: string | undefined;

    body(text: string): this {
        this.#body = text;
        return this;
    }

    button(text: string): this {
        this.#buttons.push({ text });
        return this;
    }

    show(player: Player): Promise<ActionFormResponse> {
        shownActionForms.push({
            body: this.#body,
            buttons: [...this.#buttons],
            player,
            title: this.#title,
        });
        return Promise.resolve(
            queuedActionFormResponses.shift() ?? { canceled: true },
        );
    }

    title(text: string): this {
        this.#title = text;
        return this;
    }
}

export const minecraftServerUiMockControl = {
    queueActionFormResponse(response: ActionFormResponse): void {
        queuedActionFormResponses.push(response);
    },
    get shownActionForms(): readonly ShownActionForm[] {
        return shownActionForms;
    },
    reset(): void {
        shownActionForms.length = 0;
        queuedActionFormResponses.length = 0;
    },
};
