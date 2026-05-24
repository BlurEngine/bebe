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

export type BebeAssetCompilerInput = {
    readonly pipeline: BebePipelineIntent;
    readonly projectRoot: string;
    readonly sourceJson: unknown;
    readonly sourcePath: string;
    diagnosticSeverity?(
        category: BebeToolingDiagnosticCategory,
    ): BebeToolingDiagnosticSeverity | undefined;
};

export type BebeAssetCompilerResult = {
    readonly output?: unknown;
    readonly diagnostics?: readonly BebeToolingDiagnostic[];
};

export type BebeAssetBootstrapInput = {
    readonly outputImportSpecifier: string;
    readonly outputPath: string;
};

export type BebeAssetCompiler = {
    readonly id: string;
    readonly sourcePaths: readonly string[];
    readonly outputPath: string;
    compile(input: BebeAssetCompilerInput): BebeAssetCompilerResult;
    renderBootstrap?(input: BebeAssetBootstrapInput): readonly string[];
};

export type BebeTooling = {
    readonly assetCompilers: readonly BebeAssetCompiler[];
};
