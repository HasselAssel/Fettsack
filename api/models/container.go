package models

type TrackedContainerId struct {
	Tracked_container_id *int64 `json:"tracked_container_id"`
}

type TrackedContainer struct {
	Name       *string `json:"name"`
	Started_at *int64  `json:"start_unix_timestamp"`
}

type TrackedContainerLogId struct {
	Tracked_container_log_id *int64 `json:"tracked_container_log_id"`
}

type TrackedContainerLog struct {
	TrackedContainerId
	Timestamp       *int64   `json:"unix_timestamp"`
	Grams_remaining *float64 `json:"grams_remaining"`
}

type TrackedContainerIngredientId struct {
	Tracked_container_ingredient_id *int64 `json:"Tracked_container_ingredient_id"`
}

type TrackedContainerIngredient struct {
	TrackedContainerId
	FoodId
	Grams_start *float64 `json:"grams_start"`
}
