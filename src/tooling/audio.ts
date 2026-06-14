import {
    BAUD_FILE_EXTENSION,
    GENERATED_AUDIO_FILE,
    GENERATED_AUDIO_VISUALS_FILE,
    PROJECT_AUDIO_DIRECTORY,
    compileAudioSources,
    compileAudioSourcesWithVisuals,
} from "../audio/definitions.js";
import type { BebeAssetCompiler, BebeAssetSourceFile } from "./assets.js";

export function createAudioAssetCompiler(): BebeAssetCompiler {
    return {
        id: "bebe:audio",
        sourcePaths: [PROJECT_AUDIO_DIRECTORY],
        sourceKind: "text",
        sourceMode: "collection",
        sourceFileExtensions: [BAUD_FILE_EXTENSION],
        outputPath: GENERATED_AUDIO_FILE,
        artifactOutputPaths: [
            {
                target: "scripts",
                outputPath: GENERATED_AUDIO_VISUALS_FILE,
            },
        ],
        compile(input) {
            if (input.pipeline === "dev") {
                const compilation = compileAudioSourcesWithVisuals(
                    requireAudioSourceFiles(input.sourceFiles),
                );
                return {
                    output: compilation.pack,
                    artifacts: [
                        {
                            target: "scripts",
                            outputPath: GENERATED_AUDIO_VISUALS_FILE,
                            output: compilation.visual,
                        },
                    ],
                };
            }

            return {
                output: compileAudioSources(
                    requireAudioSourceFiles(input.sourceFiles),
                ),
            };
        },
        renderBootstrap(input) {
            return [
                'import { Audio } from "@blurengine/bebe";',
                `import __bebeAudio from ${JSON.stringify(input.outputImportSpecifier)};`,
                "Audio.load(__bebeAudio);",
            ];
        },
    };
}

export const audioAssetCompiler = createAudioAssetCompiler();

function requireAudioSourceFiles(
    sourceFiles: readonly BebeAssetSourceFile[] | undefined,
): readonly BebeAssetSourceFile[] {
    if (sourceFiles === undefined) {
        throw new Error(
            "Audio asset compiler requires sourceFiles from the audio directory.",
        );
    }

    return sourceFiles;
}
