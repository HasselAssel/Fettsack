(() => {
  class TrackedContainer {
    constructor(row = {}) {
      this.tracked_container_id = row.tracked_container_id ?? null;
      this.name = row.name ?? "";
      this.start_unix_timestamp = Number(row.start_unix_timestamp ?? 0);
    }
    toApiPayload() {
      return {
        name: this.name,
        start_unix_timestamp: this.start_unix_timestamp,
      };
    }
  }

  class TrackedContainerLog {
    constructor(row = {}) {
      this.tracked_container_log_id = row.tracked_container_log_id ?? null;
      this.tracked_container_id = row.tracked_container_id ?? null;
      this.unix_timestamp = Number(row.unix_timestamp ?? 0);
      this.grams_remaining = Number(row.grams_remaining ?? 0);
    }
    toApiPayload() {
      return {
        tracked_container_id: this.tracked_container_id,
        unix_timestamp: this.unix_timestamp,
        grams_remaining: this.grams_remaining,
      };
    }
  }

  class TrackedContainerIngredient {
    constructor(row = {}) {
      // The current Go JSON tag uses a capital T. Accept both variants on reads.
      this.tracked_container_ingredient_id =
        row.Tracked_container_ingredient_id ?? row.tracked_container_ingredient_id ?? null;
      this.tracked_container_id = row.tracked_container_id ?? null;
      this.food_id = row.food_id ?? null;
      this.grams_start = Number(row.grams_start ?? 0);
    }
    toApiPayload() {
      return {
        tracked_container_id: this.tracked_container_id,
        food_id: this.food_id,
        grams_start: this.grams_start,
      };
    }
  }

  function logsForContainer(containerId, logs) {
    return logs.filter((x) => Number(x.tracked_container_id) === Number(containerId))
      .slice().sort((a,b) => a.unix_timestamp - b.unix_timestamp);
  }

  function ingredientsForContainer(containerId, ingredients) {
    return ingredients.filter((x) => Number(x.tracked_container_id) === Number(containerId));
  }

  function initialWeightForContainer(container, ingredients) {
    return ingredientsForContainer(container.tracked_container_id, ingredients)
      .reduce((sum, x) => sum + Math.max(0, Number(x.grams_start || 0)), 0);
  }

  function ingredientShares(container, ingredients) {
    const list = ingredientsForContainer(container.tracked_container_id, ingredients)
      .filter((x) => x.grams_start > 0);
    const total = list.reduce((sum,x) => sum + x.grams_start, 0);
    if (total <= 0) return [];
    return list.map((x) => ({ ingredient: x, share: x.grams_start / total }));
  }

  function intervalsForContainer(container, logs, ingredients) {
    const initialGrams = initialWeightForContainer(container, ingredients);
    if (initialGrams <= 0) return [];

    const measurements = logsForContainer(container.tracked_container_id, logs)
      .filter((log) => log.unix_timestamp > container.start_unix_timestamp);

    const intervals = [];
    let previousTimestamp = container.start_unix_timestamp;
    let previousGrams = initialGrams;

    for (const measurement of measurements) {
      const durationSeconds = measurement.unix_timestamp - previousTimestamp;
      if (durationSeconds <= 0) continue;
      const rawDifference = previousGrams - measurement.grams_remaining;
      intervals.push({
        tracked_container_id: container.tracked_container_id,
        name: container.name,
        start_unix_timestamp: previousTimestamp,
        end_unix_timestamp: measurement.unix_timestamp,
        start_grams: previousGrams,
        end_grams: measurement.grams_remaining,
        consumed_grams: Math.max(0, rawDifference),
        weight_increase_grams: Math.max(0, -rawDifference),
        duration_seconds: durationSeconds,
        end_log_id: measurement.tracked_container_log_id,
      });
      previousTimestamp = measurement.unix_timestamp;
      previousGrams = measurement.grams_remaining;
    }
    return intervals;
  }

  function allIntervals(containers, logs, ingredients) {
    return containers.flatMap((c) => intervalsForContainer(c, logs, ingredients));
  }

  // Assumption: the contents remain mixed in the same ingredient proportions.
  // Total mass lost in an interval is first apportioned by time overlap, then by
  // each ingredient's starting mass fraction. This preserves both total grams
  // and total nutrition exactly across arbitrary day/week/month ranges.
  function estimatedEntriesForRange(containers, logs, ingredients, startDate, endDateExclusive) {
    const rangeStart = startDate.getTime() / 1000;
    const rangeEnd = endDateExclusive.getTime() / 1000;
    const result = [];

    for (const container of containers) {
      const shares = ingredientShares(container, ingredients);
      if (!shares.length) continue;

      for (const interval of intervalsForContainer(container, logs, ingredients)) {
        if (interval.consumed_grams <= 0) continue;
        const overlapStart = Math.max(rangeStart, interval.start_unix_timestamp);
        const overlapEnd = Math.min(rangeEnd, interval.end_unix_timestamp);
        if (overlapEnd <= overlapStart) continue;

        const timeFraction = (overlapEnd - overlapStart) / interval.duration_seconds;
        const consumedInRange = interval.consumed_grams * timeFraction;

        for (const { ingredient, share } of shares) {
          result.push({
            estimated: true,
            tracked_container_id: container.tracked_container_id,
            tracked_container_ingredient_id: ingredient.tracked_container_ingredient_id,
            container_name: container.name,
            food_id: ingredient.food_id,
            grams: consumedInRange * share,
            ingredient_share: share,
            interval_start_unix_timestamp: interval.start_unix_timestamp,
            interval_end_unix_timestamp: interval.end_unix_timestamp,
            overlap_start_unix_timestamp: overlapStart,
            overlap_end_unix_timestamp: overlapEnd,
          });
        }
      }
    }
    return result;
  }

  function statusForContainer(container, logs, ingredients) {
    const containerLogs = logsForContainer(container.tracked_container_id, logs);
    const intervals = intervalsForContainer(container, logs, ingredients);
    const initial = initialWeightForContainer(container, ingredients);
    const latest = containerLogs.length ? containerLogs[containerLogs.length - 1] : null;
    return {
      initial_grams: initial,
      current_grams: latest ? latest.grams_remaining : initial,
      latest_unix_timestamp: latest ? latest.unix_timestamp : container.start_unix_timestamp,
      measurements: containerLogs.length,
      ingredient_count: ingredientsForContainer(container.tracked_container_id, ingredients).length,
      measured_consumed_grams: intervals.reduce((sum,i) => sum + i.consumed_grams, 0),
      weight_increase_grams: intervals.reduce((sum,i) => sum + i.weight_increase_grams, 0),
      warning_intervals: intervals.filter((i) => i.weight_increase_grams > 0).length,
    };
  }

  window.TrackedContainers = {
    TrackedContainer,
    TrackedContainerLog,
    TrackedContainerIngredient,
    // compatibility aliases for code from the previous frontend version
    FoodTrackedContainer: TrackedContainer,
    FoodTrackedContainerLog: TrackedContainerLog,
    logsForContainer,
    ingredientsForContainer,
    initialWeightForContainer,
    ingredientShares,
    intervalsForContainer,
    allIntervals,
    estimatedEntriesForRange,
    statusForContainer,
  };
})();
