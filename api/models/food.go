package models

type FoodId struct {
	Food_id *int64 `json:"food_id"`
}

type FoodLogId struct {
	Log_id *int64 `json:"log_id"`
}

type Food struct {
	Name *string `json:"name"`
	Brand *string `json:"brand"`
	Barcode *string `json:"barcode"`

	Calories *float64 `json:"calories"`
	Protein *float64 `json:"protein"`
	Fat *float64 `json:"fat"`
	Carbs *float64 `json:"carbs"`
}

type FoodLog struct {
	FoodId
	Timestamp *int64 `json:"unix_timestamp"`
	Grams *float64 `json:"grams"`
}

type FoodAndLog struct {
	Food *Food `json:"food"`
	Log *FoodLog `json:"log"`
}