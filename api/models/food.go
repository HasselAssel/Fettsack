package models

type FoodId struct {
	Food_id *int64 `json:"food_id"`
}

type Food struct {
	Name    *string `json:"name"`
	Brand   *string `json:"brand"`
	Barcode *string `json:"barcode"`

	Calories *float64 `json:"calories"`
	Protein  *float64 `json:"protein"`
	Fat      *float64 `json:"fat"`
	Carbs    *float64 `json:"carbs"`
}

type FoodLogId struct {
	Log_id *int64 `json:"log_id"`
}

type FoodLog struct {
	FoodId
	Timestamp *int64   `json:"unix_timestamp"`
	Grams     *float64 `json:"grams"`
}

type FoodAndLog struct {
	Food *Food    `json:"food"`
	Log  *FoodLog `json:"log"`
}

type FoodTrackedContainerId struct {
	Tracked_container_id *int64 `json:"tracked_container_id"`
}

type FoodTrackedContainer struct {
	FoodId
	Started_at   *int64   `json:"start_unix_timestamp"`
	Start_weight *float64 `json:"start_grams"`
	Label        *string  `json:"label"`
}

type FoodTrackedContainerLogId struct {
	Tracked_container_log_id *int64 `json:"tracked_container_log_id"`
}

type FoodTrackedContainerLog struct {
	FoodTrackedContainerId
	Timestamp       *int64   `json:"unix_timestamp"`
	Grams_remaining *float64 `json:"grams_remaining"`
}
