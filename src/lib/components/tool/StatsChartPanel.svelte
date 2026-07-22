<script lang="ts">
  import {
    ChartClipPath,
    LineChart,
    Spline,
    Tooltip,
    defaultChartPadding,
    getChartContext,
  } from "layerchart";
  import { Select } from "bits-ui";
  import { Check, ChevronDown, Plus, X } from "@lucide/svelte";
  import { towerStore } from "$lib/stores/tower.svelte";
  import { modifierStore } from "$lib/stores/modifier.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { comparatorStore } from "$lib/stores/comparator.svelte";
  import { analytics } from "$lib/services/analytics";
  import { getRofBugVer } from "$lib/utils/format";
  import type Tower from "$lib/towerComponents/tower";
  import {
    buildComparatorChart,
    listMetrics,
    listScopes,
    MAX_METRICS,
    MAX_SERIES,
    pickDefaultMetric,
    resolveScope,
    X_AXIS_OPTIONS,
    X_CASH,
    X_COST,
    X_LEVEL,
    type ComparatorSeriesDef,
  } from "$lib/utils/statsChart";
  import StatsChartYRange from "./StatsChartYRange.svelte";

  let loadingTower = $state("");

  const xItems = X_AXIS_OPTIONS.map((o) => ({ value: o.key, label: o.label }));
  const xLabel = $derived(
    X_AXIS_OPTIONS.find((o) => o.key === comparatorStore.xKey)?.label ?? "X",
  );

  const tower = $derived(towerStore.selectedData);
  const towerName = $derived(towerStore.selectedName);
  const skinName = $derived(towerStore.selectedSkinName);
  const names = $derived(towerStore.names);
  const series = $derived(comparatorStore.seriesDefs);

  const rofInfo = $derived.by(() => {
    settingsStore.rofBug;
    const info = getRofBugVer(tower?.getSkin(skinName)?.formulaTokens);
    return {
      type: info.type,
      cols: new Set(info.cols),
      enabled: settingsStore.rofBug,
    };
  });
  const modifier = $derived({ entries: modifierStore.entries });

  function isLive(def: ComparatorSeriesDef): boolean {
    return def.towerName === towerName;
  }

  function towerFor(def: ComparatorSeriesDef): Tower | null {
    return isLive(def)
      ? tower
      : (comparatorStore.towerCache[def.towerName] ?? null);
  }

  function skinFor(def: ComparatorSeriesDef): string {
    return isLive(def) ? skinName : def.skinName;
  }

  async function resolveTower(name: string): Promise<Tower | null> {
    if (name === towerName) return tower;
    if (comparatorStore.towerCache[name])
      return comparatorStore.towerCache[name];
    const mgr = towerStore.manager;
    if (!mgr) return null;
    loadingTower = name;
    try {
      const t = await mgr.getTower(name, { ephemeral: true });
      if (t) comparatorStore.cacheTower(name, t);
      return t;
    } finally {
      loadingTower = "";
    }
  }

  // any series towers missing from cache after nav or remount
  $effect(() => {
    for (const def of series) {
      if (isLive(def) || comparatorStore.towerCache[def.towerName]) continue;
      void resolveTower(def.towerName);
    }
  });

  const model = $derived.by(() => {
    towerStore.refreshTrigger;
    modifierStore.entries;
    settingsStore.rofBug;
    comparatorStore.seriesDefs;
    comparatorStore.xKey;
    comparatorStore.towerCache;

    return buildComparatorChart(
      series.map((def) => {
        const t = towerFor(def);
        return {
          def: t ? { ...def, skinName: skinFor(def) } : def,
          tower: t,
          displayName: def.towerName,
        };
      }),
      rofInfo,
      modifier,
      comparatorStore.xKey,
    );
  });

  const autoMin = $derived(model.yDomain?.[0]);
  const autoMax = $derived(model.yDomain?.[1]);
  const hasAutoY = $derived(
    autoMin != null &&
      autoMax != null &&
      Number.isFinite(autoMin) &&
      Number.isFinite(autoMax) &&
      autoMax > autoMin,
  );
  const yDomain = $derived.by((): [number, number] | undefined => {
    if (!hasAutoY) return undefined;
    const d = comparatorStore.yUserDomain;
    if (!d) return [autoMin!, autoMax!];
    const lo = Math.max(autoMin!, Math.min(d[0], d[1]));
    const hi = Math.min(autoMax!, Math.max(d[0], d[1]));
    return hi > lo ? [lo, hi] : [autoMin!, autoMax!];
  });
  const selectionKey = $derived(
    `${comparatorStore.xKey}|${series.map((s) => `${s.id}:${s.scopeId}:${s.metrics.join(",")}:${s.towerName}`).join("|")}`,
  );

  const pathScopes = $derived(
    tower && towerName
      ? listScopes(tower, skinName).filter((s) => s.kind === "path")
      : [],
  );

  function updateSeries(id: string, patch: Partial<ComparatorSeriesDef>) {
    comparatorStore.setSeries(
      series.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  function pushSeries(
    name: string,
    t: Tower,
    skin: string,
    source: "current" | "tower" | "path",
    scopeId?: string,
  ) {
    if (series.length >= MAX_SERIES) return;
    const scopes = listScopes(t, skin);
    const scope = scopeId ? resolveScope(scopes, scopeId) : scopes[0];
    if (!scope) return;
    const available = listMetrics(t, skin, scope, rofInfo, modifier);
    const metric = pickDefaultMetric(available, series[0]?.metrics[0]);
    if (!metric) return;
    comparatorStore.setSeries([
      ...series,
      {
        id: comparatorStore.nextId(),
        towerName: name,
        skinName: skin,
        scopeId: scope.id,
        metrics: [metric],
      },
    ]);
    analytics.track("stats_comparator", {
      action: "add_series",
      source,
      series_count: series.length + 1,
      tower_name: name,
    });
  }

  function addCurrentTower() {
    if (!tower || !towerName) return;
    comparatorStore.cacheTower(towerName, tower);
    pushSeries(towerName, tower, skinName, "current");
  }

  async function addTowerSeries(name: string) {
    const t = await resolveTower(name);
    if (!t) return;
    const skin = t.skinNames.includes("Regular") ? "Regular" : t.skinNames[0];
    if (!skin) return;
    pushSeries(name, t, skin, "tower");
    comparatorStore.addSeq++;
  }

  function addPathSeries() {
    if (!tower || !towerName || !pathScopes.length) return;
    const used = new Set(
      series.filter((s) => s.towerName === towerName).map((s) => s.scopeId),
    );
    const scope = pathScopes.find((s) => !used.has(s.id)) ?? pathScopes[0];
    pushSeries(towerName, tower, skinName, "path", scope.id);
  }

  const canAdd = $derived(series.length < MAX_SERIES);
  const canAddCurrent = $derived(canAdd && !!tower && !!towerName);
  const canAddPath = $derived(canAddCurrent && pathScopes.length > 0);
  const towerItems = $derived(
    names.filter((n) => n !== towerName).map((n) => ({ value: n, label: n })),
  );
  const canAddTower = $derived(canAdd && towerItems.length > 0);

  function onScopeChange(def: ComparatorSeriesDef, v: string) {
    const t = towerFor(def);
    if (!t) return;
    const skin = skinFor(def);
    const scope = resolveScope(listScopes(t, skin), v);
    if (!scope) return;
    const available = listMetrics(t, skin, scope, rofInfo, modifier);
    const kept = def.metrics.filter((m) => available.includes(m));
    updateSeries(def.id, {
      scopeId: v,
      metrics: kept.length ? kept : [pickDefaultMetric(available)].filter(Boolean),
    });
    analytics.track("stats_comparator", {
      action: "change_scope",
      scope_id: v,
      tower_name: def.towerName,
    });
  }

  function onMetricsChange(def: ComparatorSeriesDef, next: string[]) {
    const metrics = next.slice(0, MAX_METRICS);
    if (!metrics.length) return;
    updateSeries(def.id, { metrics });
    analytics.track("stats_comparator", {
      action: "change_metric",
      metric: metrics.join(","),
      tower_name: def.towerName,
    });
  }

  function metricLabel(metrics: string[]): string {
    if (!metrics.length) return "Metrics";
    if (metrics.length === 1) return metrics[0];
    return `${metrics.length} stats`;
  }
</script>

<div class="space-y-3">
  <div class="flex flex-wrap items-start justify-between gap-2">
    <div class="space-y-1">
      <h4 class="text-sm font-medium leading-none">Statistics Comparator</h4>
      <p class="text-xs text-muted-foreground">
        This uses your currently in memory tower data.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      {#if series.length}
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span class="shrink-0">X</span>
          <Select.Root
            type="single"
            items={xItems}
            value={comparatorStore.xKey}
            onValueChange={(v) => {
              if (v === X_CASH || v === X_LEVEL || v === X_COST) {
                comparatorStore.setXKey(v);
                analytics.track("stats_comparator", {
                  action: "change_x",
                  x_key: v,
                });
              }
            }}
          >
            <Select.Trigger class="select-trigger h-7! max-w-36 text-xs">
              <span class="truncate">{xLabel}</span>
              <ChevronDown class="ms-1 size-3 opacity-50" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                class="select-content max-h-55 min-w-32"
                sideOffset={5}
              >
                <Select.Viewport class="p-1">
                  {#each xItems as option (option.value)}
                    <Select.Item
                      class="select-item"
                      value={option.value}
                      label={option.label}
                    >
                      {#snippet children({ selected: isSel })}
                        {option.label}
                        {#if isSel}
                          <div class="ms-auto"><Check class="size-3" /></div>
                        {/if}
                      {/snippet}
                    </Select.Item>
                  {/each}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
        {#if canAddPath}
          <button
            type="button"
            class="inline-flex h-7 items-center gap-1 rounded-[var(--radius)_0] border border-border px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onclick={addPathSeries}
          >
            <Plus class="size-3.5" />
            Add path
          </button>
        {/if}
      {/if}
      {#if canAddTower}
        {#key comparatorStore.addSeq}
          <Select.Root
            type="single"
            items={towerItems}
            onValueChange={(v) => {
              if (v) void addTowerSeries(v);
            }}
          >
            <Select.Trigger class="select-trigger h-7! max-w-44 gap-1 text-xs">
              <span class="truncate">Add Tower</span>
              <ChevronDown class="ms-0.5 size-3 opacity-50" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                class="select-content max-h-55 min-w-40"
                sideOffset={5}
              >
                <Select.Viewport class="p-1">
                  {#each towerItems as option (option.value)}
                    <Select.Item
                      class="select-item"
                      value={option.value}
                      label={option.label}
                    >
                      {#snippet children({ selected: isSel })}
                        {option.label}
                        {#if isSel}
                          <div class="ms-auto"><Check class="size-3" /></div>
                        {/if}
                      {/snippet}
                    </Select.Item>
                  {/each}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        {/key}
      {/if}
    </div>
  </div>

  {#if loadingTower}
    <p class="text-[11px] text-muted-foreground">Loading {loadingTower}…</p>
  {/if}

  {#if model.hasPoints && yDomain && hasAutoY}
    <div
      class="lc-root-container h-56 w-full overflow-hidden rounded-[var(--radius)_0] border border-border bg-card/40 p-1"
    >
      <LineChart
        data={model.data}
        x="x"
        series={model.series}
        {yDomain}
        yBaseline={null}
        clip
        height={216}
        padding={defaultChartPadding({
          left: 40,
          bottom: 28,
          right: 10,
          top: 8,
        })}
        props={{
          xAxis: { label: model.xLabel, tickLength: 4 },
          yAxis: { tickLength: 4 },
          grid: { x: false, y: true },
          rule: { x: true, y: true },
          highlight: { points: { r: 3 } },
        }}
      >
        {#snippet marks({ context })}
          <ChartClipPath>
            {#each context.series.visibleSeries as s (s.key)}
              <Spline
                seriesKey={s.key}
                strokeWidth={2}
                stroke={s.color ?? "var(--color-chart-1)"}
              />
            {/each}
          </ChartClipPath>
        {/snippet}
        {#snippet tooltip()}
          {@const ctx = getChartContext()}
          {@const visible = ctx.tooltip.series.filter((s) => s.visible)}
          {@const headerVal = ctx.tooltip.data
            ? ctx.valueAxis === "y"
              ? ctx.x(ctx.tooltip.data)
              : ctx.y(ctx.tooltip.data)
            : undefined}
          <Tooltip.Root context={ctx}>
            <Tooltip.Header value={headerVal} />
            <Tooltip.List>
              {#each visible as s, i (s.key ?? i)}
                <Tooltip.Item
                  label={s.label}
                  value={s.value}
                  color={s.color}
                  valueAlign="right"
                />
              {/each}
            </Tooltip.List>
          </Tooltip.Root>
        {/snippet}
      </LineChart>
    </div>

    {#key selectionKey}
      <StatsChartYRange
        min={autoMin!}
        max={autoMax!}
        onDomain={(d) => (comparatorStore.yUserDomain = d)}
      />
    {/key}
  {:else if !series.length}
    <div
      class="flex h-56 flex-col items-center justify-center gap-3 rounded-[var(--radius)_0] border border-dashed border-border"
    >
      {#if canAddCurrent}
        <button
          type="button"
          class="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)_0] border border-border bg-secondary px-3 text-xs font-medium text-foreground hover:bg-muted"
          onclick={addCurrentTower}
        >
          Add Current Tower
        </button>
      {/if}
    </div>
  {/if}

  {#if model.rows.length}
    <div class="space-y-2">
      {#each model.rows as row (row.def.id)}
        <div
          class="flex flex-wrap items-center gap-1.5 rounded-[var(--radius)_0] border border-border/80 bg-card/30 px-2 py-1.5"
        >
          <span class="flex shrink-0 items-center gap-0.5">
            {#each row.colors as c, ci (ci)}
              <span
                class="size-2.5 rounded-full"
                style="background: {c}"
              ></span>
            {/each}
          </span>
          <span
            class="max-w-28 truncate text-xs font-medium"
            title={row.def.towerName}
          >
            {row.def.towerName}
          </span>

          {#if row.scopeItems.length > 1}
            <Select.Root
              type="single"
              items={row.scopeItems}
              value={row.def.scopeId}
              onValueChange={(v) => {
                if (v) onScopeChange(row.def, v);
              }}
            >
              <Select.Trigger class="select-trigger h-7! max-w-32 text-xs">
                <span class="truncate">
                  {row.scopeItems.find((s) => s.value === row.def.scopeId)
                    ?.label ?? "Scope"}
                </span>
                <ChevronDown class="ms-1 size-3 opacity-50" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  class="select-content max-h-55 min-w-32"
                  sideOffset={5}
                >
                  <Select.Viewport class="p-1">
                    {#each row.scopeItems as option (option.value)}
                      <Select.Item
                        class="select-item"
                        value={option.value}
                        label={option.label}
                      >
                        {#snippet children({ selected: isSel })}
                          {option.label}
                          {#if isSel}
                            <div class="ms-auto"><Check class="size-3" /></div>
                          {/if}
                        {/snippet}
                      </Select.Item>
                    {/each}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          {/if}

          <Select.Root
            type="multiple"
            items={row.metricItems}
            value={row.def.metrics}
            onValueChange={(v) => onMetricsChange(row.def, v ?? [])}
          >
            <Select.Trigger
              class="select-trigger h-7! max-w-40 text-xs"
              title={row.def.metrics.join(", ")}
            >
              <span class="truncate">{metricLabel(row.def.metrics)}</span>
              <ChevronDown class="ms-1 size-3 opacity-50" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                class="select-content max-h-55 min-w-36"
                sideOffset={5}
              >
                <Select.Viewport class="p-1">
                  {#each row.metricItems as option (option.value)}
                    <Select.Item
                      class="select-item"
                      value={option.value}
                      label={option.label}
                      disabled={row.def.metrics.length >= MAX_METRICS &&
                        !row.def.metrics.includes(option.value)}
                    >
                      {#snippet children({ selected: isSel })}
                        {option.label}
                        {#if isSel}
                          <div class="ms-auto"><Check class="size-3" /></div>
                        {/if}
                      {/snippet}
                    </Select.Item>
                  {/each}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

          <button
            type="button"
            class="ms-auto inline-flex size-7 items-center justify-center rounded-[var(--radius)_0] text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Remove series"
            onclick={() => {
              const next = series.filter((s) => s.id !== row.def.id);
              comparatorStore.setSeries(next);
              analytics.track("stats_comparator", {
                action: "remove_series",
                series_count: next.length,
              });
            }}
          >
            <X class="size-3.5" />
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
