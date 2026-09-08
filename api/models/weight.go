package models

type WeightLogId struct {
	Weight_id *int64 `json:"weight_id"`
}

type WeightLog struct {
	Timestamp *int64   `json:"unix_timestamp"`
	Grams     *float64 `json:"grams"`
}
