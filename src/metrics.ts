export type MetricsLabelValue = string | number | boolean;
export type MetricsLabels = Readonly<Record<string, MetricsLabelValue>>;

export type MetricKind = "counter" | "gauge" | "histogram";

export type MetricOptions = {
    help?: string;
    labelNames?: readonly string[];
};

export type HistogramMetricOptions = MetricOptions & {
    buckets?: readonly number[];
};

export type HistogramBucketSnapshot = {
    le: number | "+Inf";
    count: number;
};

export type HistogramSnapshot = {
    buckets: readonly HistogramBucketSnapshot[];
    count: number;
    sum: number;
};

export type MetricSampleSnapshot =
    | {
          labels: MetricsLabels;
          value: number;
      }
    | ({
          labels: MetricsLabels;
      } & HistogramSnapshot);

export type MetricSnapshot = {
    help?: string;
    kind: MetricKind;
    labelNames: readonly string[];
    name: string;
    samples: readonly MetricSampleSnapshot[];
};

export type MetricsSnapshot = {
    metrics: readonly MetricSnapshot[];
};

export interface CounterMetric {
    readonly name: string;
    add(value: number, labels?: MetricsLabels): void;
    count(labels?: MetricsLabels): void;
    get(labels?: MetricsLabels): number;
}

export interface GaugeMetric {
    readonly name: string;
    add(value: number, labels?: MetricsLabels): void;
    dec(labels?: MetricsLabels): void;
    get(labels?: MetricsLabels): number;
    inc(labels?: MetricsLabels): void;
    set(value: number, labels?: MetricsLabels): void;
}

export interface HistogramMetric {
    readonly name: string;
    get(labels?: MetricsLabels): HistogramSnapshot;
    observe(value: number, labels?: MetricsLabels): void;
}

export interface MetricsService {
    counter(name: string, options?: MetricOptions): CounterMetric;
    gauge(name: string, options?: MetricOptions): GaugeMetric;
    histogram(name: string, options?: HistogramMetricOptions): HistogramMetric;
    snapshot(): MetricsSnapshot;
    toPrometheusText(): string;
}

type NormalizedLabels = Readonly<Record<string, string>>;

type NumberSeries = {
    readonly labels: NormalizedLabels;
    value: number;
};

type HistogramSeries = {
    readonly labels: NormalizedLabels;
    readonly buckets: number[];
    count: number;
    sum: number;
};

type BaseMetricDefinition = {
    readonly help?: string;
    readonly labelNames: readonly string[];
    readonly name: string;
};

type CounterDefinition = BaseMetricDefinition & {
    readonly kind: "counter";
    readonly series: Map<string, NumberSeries>;
};

type GaugeDefinition = BaseMetricDefinition & {
    readonly kind: "gauge";
    readonly series: Map<string, NumberSeries>;
};

type HistogramDefinition = BaseMetricDefinition & {
    readonly buckets: readonly number[];
    readonly kind: "histogram";
    readonly series: Map<string, HistogramSeries>;
};

type MetricDefinition =
    | CounterDefinition
    | GaugeDefinition
    | HistogramDefinition;

const METRIC_NAME_PATTERN = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/u;
const LABEL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/u;
const DEFAULT_HISTOGRAM_BUCKETS = Object.freeze([
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const);

function validateMetricName(name: string): void {
    if (!METRIC_NAME_PATTERN.test(name)) {
        throw new Error(`Invalid metric name: ${name}`);
    }
}

function validateCounterName(name: string): void {
    if (!name.endsWith("_total")) {
        throw new Error(`Counter metric names must end with _total: ${name}`);
    }
}

function validateLabelName(name: string): void {
    if (!LABEL_NAME_PATTERN.test(name)) {
        throw new Error(`Invalid metric label name: ${name}`);
    }
}

function validateFiniteNumber(value: number, subject: string): void {
    if (!Number.isFinite(value)) {
        throw new Error(`${subject} must be a finite number.`);
    }
}

function normalizeLabelNames(labelNames: readonly string[] = []): string[] {
    const seen = new Set<string>();
    return labelNames.map((name) => {
        validateLabelName(name);
        if (seen.has(name)) {
            throw new Error(`Duplicate metric label name: ${name}`);
        }
        seen.add(name);
        return name;
    });
}

function normalizeBuckets(
    input: readonly number[] | undefined,
): readonly number[] {
    const buckets = [...(input ?? DEFAULT_HISTOGRAM_BUCKETS)];
    for (const bucket of buckets) {
        validateFiniteNumber(bucket, "Histogram bucket");
    }
    return Object.freeze([...new Set(buckets)].sort((a, b) => a - b));
}

function sameValues(
    left: readonly string[] | readonly number[],
    right: readonly string[] | readonly number[],
): boolean {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    );
}

function normalizeLabels(
    definition: BaseMetricDefinition,
    labels: MetricsLabels | undefined,
): NormalizedLabels {
    const input = labels ?? {};
    const inputKeys = Object.keys(input);
    const expected = new Set(definition.labelNames);

    for (const name of definition.labelNames) {
        if (!(name in input)) {
            throw new Error(`Metric ${definition.name} missing label ${name}.`);
        }
    }
    for (const name of inputKeys) {
        if (!expected.has(name)) {
            throw new Error(
                `Metric ${definition.name} received unexpected label ${name}.`,
            );
        }
    }

    const output: Record<string, string> = {};
    for (const name of definition.labelNames) {
        const value = input[name];
        const valueType = typeof value;
        if (
            valueType !== "string" &&
            valueType !== "number" &&
            valueType !== "boolean"
        ) {
            throw new Error(
                `Metric ${definition.name} label ${name} must be a string, number, or boolean.`,
            );
        }
        output[name] = String(value);
    }
    return output;
}

function labelsKey(
    definition: BaseMetricDefinition,
    labels: NormalizedLabels,
): string {
    return definition.labelNames
        .map((name) => `${name}\u0000${labels[name]}`)
        .join("\u0001");
}

function readNumberSeries(
    definition: CounterDefinition | GaugeDefinition,
    labels: MetricsLabels | undefined,
): NumberSeries {
    const normalizedLabels = normalizeLabels(definition, labels);
    const key = labelsKey(definition, normalizedLabels);
    const existing = definition.series.get(key);
    if (existing) {
        return existing;
    }

    const series: NumberSeries = {
        labels: normalizedLabels,
        value: 0,
    };
    definition.series.set(key, series);
    return series;
}

function readHistogramSeries(
    definition: HistogramDefinition,
    labels: MetricsLabels | undefined,
): HistogramSeries {
    const normalizedLabels = normalizeLabels(definition, labels);
    const key = labelsKey(definition, normalizedLabels);
    const existing = definition.series.get(key);
    if (existing) {
        return existing;
    }

    const series: HistogramSeries = {
        buckets: Array.from({ length: definition.buckets.length }, () => 0),
        count: 0,
        labels: normalizedLabels,
        sum: 0,
    };
    definition.series.set(key, series);
    return series;
}

function cloneLabels(labels: NormalizedLabels): MetricsLabels {
    return Object.freeze({ ...labels });
}

function histogramSnapshot(
    definition: HistogramDefinition,
    series: HistogramSeries,
): HistogramSnapshot {
    return {
        buckets: Object.freeze([
            ...series.buckets.map((count, index) => ({
                count,
                le: definition.buckets[index],
            })),
            {
                count: series.count,
                le: "+Inf" as const,
            },
        ]),
        count: series.count,
        sum: series.sum,
    };
}

function escapeHelp(value: string): string {
    return value.replace(/\\/gu, "\\\\").replace(/\n/gu, "\\n");
}

function escapeLabelValue(value: string): string {
    return value
        .replace(/\\/gu, "\\\\")
        .replace(/\n/gu, "\\n")
        .replace(/"/gu, '\\"');
}

function formatNumber(value: number): string {
    return Object.is(value, -0) ? "0" : String(value);
}

function formatLabelSet(
    labels: NormalizedLabels,
    labelNames: readonly string[],
    extraLabels: MetricsLabels = {},
): string {
    const entries = [
        ...labelNames.map((name) => [name, labels[name]] as const),
        ...Object.entries(extraLabels).map(
            ([name, value]) => [name, String(value)] as const,
        ),
    ];
    if (entries.length === 0) {
        return "";
    }
    return `{${entries
        .map(([name, value]) => `${name}="${escapeLabelValue(value)}"`)
        .join(",")}}`;
}

class CounterMetricHandle implements CounterMetric {
    readonly #definition: CounterDefinition;
    readonly #runtime: MetricsRuntime;

    constructor(runtime: MetricsRuntime, definition: CounterDefinition) {
        this.#definition = definition;
        this.#runtime = runtime;
    }

    get name(): string {
        return this.#definition.name;
    }

    add(value: number, labels?: MetricsLabels): void {
        this.#runtime.addCounter(this.#definition, value, labels);
    }

    count(labels?: MetricsLabels): void {
        this.add(1, labels);
    }

    get(labels?: MetricsLabels): number {
        return this.#runtime.getNumber(this.#definition, labels);
    }
}

class GaugeMetricHandle implements GaugeMetric {
    readonly #definition: GaugeDefinition;
    readonly #runtime: MetricsRuntime;

    constructor(runtime: MetricsRuntime, definition: GaugeDefinition) {
        this.#definition = definition;
        this.#runtime = runtime;
    }

    get name(): string {
        return this.#definition.name;
    }

    add(value: number, labels?: MetricsLabels): void {
        this.#runtime.addGauge(this.#definition, value, labels);
    }

    dec(labels?: MetricsLabels): void {
        this.add(-1, labels);
    }

    get(labels?: MetricsLabels): number {
        return this.#runtime.getNumber(this.#definition, labels);
    }

    inc(labels?: MetricsLabels): void {
        this.add(1, labels);
    }

    set(value: number, labels?: MetricsLabels): void {
        this.#runtime.setGauge(this.#definition, value, labels);
    }
}

class HistogramMetricHandle implements HistogramMetric {
    readonly #definition: HistogramDefinition;
    readonly #runtime: MetricsRuntime;

    constructor(runtime: MetricsRuntime, definition: HistogramDefinition) {
        this.#definition = definition;
        this.#runtime = runtime;
    }

    get name(): string {
        return this.#definition.name;
    }

    get(labels?: MetricsLabels): HistogramSnapshot {
        return this.#runtime.getHistogram(this.#definition, labels);
    }

    observe(value: number, labels?: MetricsLabels): void {
        this.#runtime.observeHistogram(this.#definition, value, labels);
    }
}

class MetricsRuntime {
    readonly #definitions = new Map<string, MetricDefinition>();

    addCounter(
        definition: CounterDefinition,
        value: number,
        labels?: MetricsLabels,
    ): void {
        validateFiniteNumber(value, "Counter value");
        if (value < 0) {
            throw new Error("Counter metrics cannot decrease.");
        }
        readNumberSeries(definition, labels).value += value;
    }

    addGauge(
        definition: GaugeDefinition,
        value: number,
        labels?: MetricsLabels,
    ): void {
        validateFiniteNumber(value, "Gauge value");
        readNumberSeries(definition, labels).value += value;
    }

    clear(): void {
        for (const definition of this.#definitions.values()) {
            definition.series.clear();
        }
    }

    counter(name: string, options?: MetricOptions): CounterMetric {
        validateCounterName(name);
        return new CounterMetricHandle(
            this,
            this.#defineNumberMetric("counter", name, options),
        );
    }

    gauge(name: string, options?: MetricOptions): GaugeMetric {
        return new GaugeMetricHandle(
            this,
            this.#defineNumberMetric("gauge", name, options),
        );
    }

    getHistogram(
        definition: HistogramDefinition,
        labels?: MetricsLabels,
    ): HistogramSnapshot {
        return histogramSnapshot(
            definition,
            readHistogramSeries(definition, labels),
        );
    }

    getNumber(
        definition: CounterDefinition | GaugeDefinition,
        labels?: MetricsLabels,
    ): number {
        return readNumberSeries(definition, labels).value;
    }

    histogram(name: string, options?: HistogramMetricOptions): HistogramMetric {
        return new HistogramMetricHandle(
            this,
            this.#defineHistogramMetric(name, options),
        );
    }

    observeHistogram(
        definition: HistogramDefinition,
        value: number,
        labels?: MetricsLabels,
    ): void {
        validateFiniteNumber(value, "Histogram observation");
        const series = readHistogramSeries(definition, labels);
        series.count += 1;
        series.sum += value;
        definition.buckets.forEach((bucket, index) => {
            if (value <= bucket) {
                series.buckets[index] += 1;
            }
        });
    }

    setGauge(
        definition: GaugeDefinition,
        value: number,
        labels?: MetricsLabels,
    ): void {
        validateFiniteNumber(value, "Gauge value");
        readNumberSeries(definition, labels).value = value;
    }

    snapshot(): MetricsSnapshot {
        return {
            metrics: Object.freeze(
                [...this.#definitions.values()].map((definition) => ({
                    help: definition.help,
                    kind: definition.kind,
                    labelNames: Object.freeze([...definition.labelNames]),
                    name: definition.name,
                    samples: Object.freeze(this.#snapshotSamples(definition)),
                })),
            ),
        };
    }

    toPrometheusText(): string {
        const lines: string[] = [];
        for (const definition of this.#definitions.values()) {
            if (definition.series.size === 0) {
                continue;
            }
            if (definition.help) {
                lines.push(
                    `# HELP ${definition.name} ${escapeHelp(definition.help)}`,
                );
            }
            lines.push(`# TYPE ${definition.name} ${definition.kind}`);

            if (definition.kind === "histogram") {
                this.#writeHistogramLines(lines, definition);
            } else {
                this.#writeNumberLines(lines, definition);
            }
        }
        return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    }

    #defineBase(
        kind: MetricKind,
        name: string,
        options?: MetricOptions,
    ): BaseMetricDefinition {
        validateMetricName(name);
        const labelNames = Object.freeze(
            normalizeLabelNames(options?.labelNames),
        );
        const existing = this.#definitions.get(name);
        if (existing) {
            if (
                existing.kind !== kind ||
                !sameValues(existing.labelNames, labelNames)
            ) {
                throw new Error(`Metric ${name} is already defined.`);
            }
            return existing;
        }
        return {
            help: options?.help,
            labelNames,
            name,
        };
    }

    #defineHistogramMetric(
        name: string,
        options?: HistogramMetricOptions,
    ): HistogramDefinition {
        const base = this.#defineBase("histogram", name, options);
        const existing = this.#definitions.get(name);
        const buckets = normalizeBuckets(options?.buckets);
        if (existing) {
            if (existing.kind !== "histogram") {
                throw new Error(`Metric ${name} is already defined.`);
            }
            if (!sameValues(existing.buckets, buckets)) {
                throw new Error(
                    `Metric ${name} is already defined with different buckets.`,
                );
            }
            return existing;
        }

        const definition: HistogramDefinition = {
            ...base,
            buckets,
            kind: "histogram",
            series: new Map(),
        };
        this.#definitions.set(name, definition);
        return definition;
    }

    #defineNumberMetric(
        kind: "counter",
        name: string,
        options?: MetricOptions,
    ): CounterDefinition;
    #defineNumberMetric(
        kind: "gauge",
        name: string,
        options?: MetricOptions,
    ): GaugeDefinition;
    #defineNumberMetric(
        kind: "counter" | "gauge",
        name: string,
        options?: MetricOptions,
    ): CounterDefinition | GaugeDefinition {
        const base = this.#defineBase(kind, name, options);
        const existing = this.#definitions.get(name);
        if (existing) {
            if (existing.kind === kind) {
                return existing;
            }
            throw new Error(`Metric ${name} is already defined.`);
        }

        const definition = {
            ...base,
            kind,
            series: new Map<string, NumberSeries>(),
        } as CounterDefinition | GaugeDefinition;
        this.#definitions.set(name, definition);
        return definition;
    }

    #snapshotSamples(definition: MetricDefinition): MetricSampleSnapshot[] {
        if (definition.kind === "histogram") {
            return [...definition.series.values()].map((series) => ({
                labels: cloneLabels(series.labels),
                ...histogramSnapshot(definition, series),
            }));
        }

        return [...definition.series.values()].map((series) => ({
            labels: cloneLabels(series.labels),
            value: series.value,
        }));
    }

    #writeHistogramLines(
        lines: string[],
        definition: HistogramDefinition,
    ): void {
        for (const series of definition.series.values()) {
            definition.buckets.forEach((bucket, index) => {
                lines.push(
                    `${definition.name}_bucket${formatLabelSet(
                        series.labels,
                        definition.labelNames,
                        { le: bucket },
                    )} ${formatNumber(series.buckets[index])}`,
                );
            });
            lines.push(
                `${definition.name}_bucket${formatLabelSet(
                    series.labels,
                    definition.labelNames,
                    { le: "+Inf" },
                )} ${formatNumber(series.count)}`,
            );
            lines.push(
                `${definition.name}_sum${formatLabelSet(
                    series.labels,
                    definition.labelNames,
                )} ${formatNumber(series.sum)}`,
            );
            lines.push(
                `${definition.name}_count${formatLabelSet(
                    series.labels,
                    definition.labelNames,
                )} ${formatNumber(series.count)}`,
            );
        }
    }

    #writeNumberLines(
        lines: string[],
        definition: CounterDefinition | GaugeDefinition,
    ): void {
        for (const series of definition.series.values()) {
            lines.push(
                `${definition.name}${formatLabelSet(
                    series.labels,
                    definition.labelNames,
                )} ${formatNumber(series.value)}`,
            );
        }
    }
}

const runtime = new MetricsRuntime();

export const Metrics: MetricsService = Object.freeze({
    counter(name: string, options?: MetricOptions): CounterMetric {
        return runtime.counter(name, options);
    },
    gauge(name: string, options?: MetricOptions): GaugeMetric {
        return runtime.gauge(name, options);
    },
    histogram(name: string, options?: HistogramMetricOptions): HistogramMetric {
        return runtime.histogram(name, options);
    },
    snapshot(): MetricsSnapshot {
        return runtime.snapshot();
    },
    toPrometheusText(): string {
        return runtime.toPrometheusText();
    },
});

export function clearMetrics(): void {
    runtime.clear();
}
