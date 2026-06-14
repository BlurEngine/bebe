export type BebePipelineIntent = "dev" | "build" | "package" | "check";

export type BebeToolingDiagnosticSeverity = "ignore" | "warn" | "error";

export type BebeToolingDiagnosticCategory =
    | "missingReferences"
    | "invalidAsset"
    | "tooling";

export type BebeToolingDiagnostic = {
    readonly code: string;
    readonly category: BebeToolingDiagnosticCategory;
    readonly message: string;
    readonly severity?: BebeToolingDiagnosticSeverity;
    readonly sourcePath?: string;
};

export type BebeAssetSourceKind = "json" | "text";

export type BebeAssetSourceMode = "single" | "collection";

export type BebeAssetSourceFile = {
    readonly relativePath: string;
    readonly absolutePath: string;
    readonly text: string;
};

export type BebeAssetCompilerInput = {
    readonly pipeline: BebePipelineIntent;
    readonly projectRoot: string;
    readonly sourceJson?: unknown;
    readonly sourceText?: string;
    readonly sourceFiles?: readonly BebeAssetSourceFile[];
    readonly sourcePath: string;
    diagnosticSeverity?(
        category: BebeToolingDiagnosticCategory,
    ): BebeToolingDiagnosticSeverity | undefined;
};

export type BebeAssetCompilerResult = {
    readonly output?: unknown;
    readonly artifacts?: readonly BebeAssetCompilerArtifact[];
    readonly diagnostics?: readonly BebeToolingDiagnostic[];
};

export type BebeAssetCompilerArtifactTarget =
    | "behaviorPack"
    | "resourcePack"
    | "scripts";

export type BebeAssetCompilerArtifactOutputPath = {
    readonly target: BebeAssetCompilerArtifactTarget;
    readonly outputPath: string;
};

export type BebeAssetCompilerArtifact = {
    readonly target: BebeAssetCompilerArtifactTarget;
    readonly outputPath: string;
    readonly output: unknown;
};

export type BebeAssetBootstrapInput = {
    readonly outputImportSpecifier: string;
    readonly outputPath: string;
};

export type BebeAssetCompiler = {
    readonly id: string;
    readonly sourcePaths: readonly string[];
    readonly outputPath: string;
    readonly sourceKind?: BebeAssetSourceKind;
    readonly sourceMode?: BebeAssetSourceMode;
    readonly sourceFileExtensions?: readonly string[];
    readonly artifactOutputPaths?: readonly BebeAssetCompilerArtifactOutputPath[];
    compile(input: BebeAssetCompilerInput): BebeAssetCompilerResult;
    renderBootstrap?(input: BebeAssetBootstrapInput): readonly string[];
};

export type BebeTooling = {
    readonly assetCompilers: readonly BebeAssetCompiler[];
};
