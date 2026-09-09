(() => {
  class FoodTrackedContainer {
    constructor(row = {}) {
      this.tracked_container_id = row.tracked_container_id ?? null;
      this.food_id = row.food_id ?? null;
      this.start_unix_timestamp = Number(row.start_unix_timestamp ?? 0);
      this.start_grams = Number(row.start_grams ?? 0);
      this.label = row.label ?? "";
    }

    toApiPayload() {
      return {
        food_id: this.food_id,
        start_unix_timestamp: this.start_unix_timestamp,
        start_grams: this.start_grams,
        label: this.label || null,
      };
    }
  }

  class FoodTrackedContainerLog {
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

  function logsForContainer(containerId, logs) {
    return logs
      .filter((log) => Number(log.tracked_container_id) === Number(containerId))
      .slice()
      .sort((a, b) => a.unix_timestamp - b.unix_timestamp);
  }

  function intervalsForContainer(container, logs) {
    const measurements = logsForContainer(container.tracked_container_id, logs)
      .filter((log) => log.unix_timestamp > container.start_unix_timestamp);

    const intervals = [];
    let previousTimestamp = container.start_unix_timestamp;
    let previousGrams = container.start_grams;

    for (const measurement of measurements) {
      const durationSeconds = measurement.unix_timestamp - previousTimestamp;
      if (durationSeconds <= 0) continue;

      const rawDifference = previousGrams - measurement.grams_remaining;

      intervals.push({
        tracked_container_id: container.tracked_container_id,
        food_id: container.food_id,
        label: container.label,
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

  function allIntervals(containers, logs) {
    return containers.flatMap((container) => intervalsForContainer(container, logs));
  }

  // Consumption is assumed uniform between two known measurements.
  // The overlap calculation automatically gives each calendar day its fair
  // share, including partial first/last days and DST transitions.
  function estimatedEntriesForRange(containers, logs, startDate, endDateExclusive) {
    const rangeStart = startDate.getTime() / 1000;
    const rangeEnd = endDateExclusive.getTime() / 1000;
    const result = [];

    for (const interval of allIntervals(containers, logs)) {
      if (interval.consumed_grams <= 0) continue;

      const overlapStart = Math.max(rangeStart, interval.start_unix_timestamp);
      const overlapEnd = Math.min(rangeEnd, interval.end_unix_timestamp);
      if (overlapEnd <= overlapStart) continue;

      const fraction = (overlapEnd - overlapStart) / interval.duration_seconds;
      const grams = interval.consumed_grams * fraction;

      result.push({
        estimated: true,
        tracked_container_id: interval.tracked_container_id,
        food_id: interval.food_id,
        label: interval.label,
        grams,
        interval_start_unix_timestamp: interval.start_unix_timestamp,
        interval_end_unix_timestamp: interval.end_unix_timestamp,
        overlap_start_unix_timestamp: overlapStart,
        overlap_end_unix_timestamp: overlapEnd,
      });
    }

    return result;
  }

  function statusForContainer(container, logs) {
    const containerLogs = logsForContainer(container.tracked_container_id, logs);
    const intervals = intervalsForContainer(container, logs);
    const latest = containerLogs.length ? containerLogs[containerLogs.length - 1] : null;

    return {
      current_grams: latest ? latest.grams_remaining : container.start_grams,
      latest_unix_timestamp: latest ? latest.unix_timestamp : container.start_unix_timestamp,
      measurements: containerLogs.length,
      measured_consumed_grams: intervals.reduce((sum, i) => sum + i.consumed_grams, 0),
      weight_increase_grams: intervals.reduce((sum, i) => sum + i.weight_increase_grams, 0),
      warning_intervals: intervals.filter((i) => i.weight_increase_grams > 0).length,
    };
  }

  window.TrackedContainers = {
    FoodTrackedContainer,
    FoodTrackedContainerLog,
    logsForContainer,
    intervalsForContainer,
    allIntervals,
    estimatedEntriesForRange,
    statusForContainer,
  };
})();
