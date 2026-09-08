package logic

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/HasselAssel/Fettsack/api/models"

	_ "modernc.org/sqlite"
)

func EnsureFoodTables(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		CREATE TABLE IF NOT EXISTS foods (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			name TEXT NOT NULL,
			brand TEXT NOT NULL DEFAULT '',
			barcode TEXT NOT NULL DEFAULT '',

			calories_per_100g REAL NOT NULL DEFAULT -1,
			protein_per_100g REAL NOT NULL DEFAULT -1,
			fat_per_100g REAL NOT NULL DEFAULT -1,
			carbs_per_100g REAL NOT NULL DEFAULT -1,

			UNIQUE (
				name,
				brand,
				barcode,
				calories_per_100g,
				protein_per_100g,
				fat_per_100g,
				carbs_per_100g
			)
		);

		CREATE TABLE IF NOT EXISTS food_owners (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,
			food_id INTEGER NOT NULL,

			FOREIGN KEY (food_id) REFERENCES foods(id),

			UNIQUE (user, food_id)
		);

		CREATE TABLE IF NOT EXISTS food_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,
    		food_id INTEGER NOT NULL,

			timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
			grams REAL NOT NULL CHECK (grams > 0),

			FOREIGN KEY (food_id) REFERENCES foods(id)
		);

		CREATE TABLE IF NOT EXISTS tracked_food_containers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,
			food_id INTEGER NOT NULL,

			started_at INTEGER NOT NULL DEFAULT (unixepoch()),
			start_weight REAL NOT NULL CHECK (start_weight > 0),

			label TEXT,

			FOREIGN KEY (food_id) REFERENCES foods(id)
		);

		CREATE TABLE IF NOT EXISTS tracked_food_measurements (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,
			container_id INTEGER NOT NULL,

			timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
			grams_remaining REAL NOT NULL CHECK (grams_remaining >= 0),

			FOREIGN KEY (container_id) REFERENCES tracked_food_containers(id)
		);
	`)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func GetFoodsFromDB(db *sql.DB, user models.User) ([]struct {
	models.FoodId
	models.Food
}, error) {
	rows, err := db.Query(`
		SELECT
			f.id,
			f.name,
			f.brand,
			f.barcode,
			f.calories_per_100g,
			f.protein_per_100g,
			f.fat_per_100g,
			f.carbs_per_100g
		FROM foods f
		JOIN food_owners fo ON fo.food_id = f.id
		WHERE fo.user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var foods []struct {
		models.FoodId
		models.Food
	}

	for rows.Next() {
		var foodId models.FoodId
		var food models.Food

		err := rows.Scan(
			&foodId.Food_id,
			&food.Name,
			&food.Brand,
			&food.Barcode,
			&food.Calories,
			&food.Protein,
			&food.Fat,
			&food.Carbs,
		)
		if err != nil {
			return nil, err
		}

		foods = append(foods, struct {
			models.FoodId
			models.Food
		}{
			FoodId: foodId,
			Food:   food,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return foods, nil
}

func GetFoodLogsFromDB(db *sql.DB, user models.User) ([]struct {
	models.FoodLogId
	models.FoodLog
}, error) {
	rows, err := db.Query(`
		SELECT
			id,
			food_id,
			timestamp,
			grams
		FROM food_log
		WHERE user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []struct {
		models.FoodLogId
		models.FoodLog
	}

	for rows.Next() {
		var logId models.FoodLogId
		var log models.FoodLog

		err := rows.Scan(
			&logId.Log_id,
			&log.Food_id,
			&log.Timestamp,
			&log.Grams,
		)
		if err != nil {
			return nil, err
		}

		logs = append(logs, struct {
			models.FoodLogId
			models.FoodLog
		}{
			FoodLogId: logId,
			FoodLog:   log,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return logs, nil
}

func GetTrackedFoodContainersFromDB(db *sql.DB, user models.User) ([]struct {
	models.FoodTrackedContainerId
	models.FoodTrackedContainer
}, error) {
	rows, err := db.Query(`
		SELECT
			id,
			food_id,
			started_at,
			start_weight,
			label
		FROM tracked_food_containers
		WHERE user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []struct {
		models.FoodTrackedContainerId
		models.FoodTrackedContainer
	}

	for rows.Next() {
		var containerId models.FoodTrackedContainerId
		var container models.FoodTrackedContainer

		err := rows.Scan(
			&containerId.Tracked_container_id,
			&container.Food_id,
			&container.Started_at,
			&container.Start_weight,
			&container.Label,
		)
		if err != nil {
			return nil, err
		}

		containers = append(containers, struct {
			models.FoodTrackedContainerId
			models.FoodTrackedContainer
		}{
			FoodTrackedContainerId: containerId,
			FoodTrackedContainer:   container,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return containers, nil
}

func GetTrackedFoodContainerLogsFromDB(db *sql.DB, user models.User) ([]struct {
	models.FoodTrackedContainerLogId
	models.FoodTrackedContainerLog
}, error) {
	rows, err := db.Query(`
		SELECT
			id,
			container_id,
			timestamp,
			grams_remaining
		FROM tracked_food_measurements
		WHERE user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []struct {
		models.FoodTrackedContainerLogId
		models.FoodTrackedContainerLog
	}

	for rows.Next() {
		var logId models.FoodTrackedContainerLogId
		var log models.FoodTrackedContainerLog

		err := rows.Scan(
			&logId.Tracked_container_log_id,
			&log.Tracked_container_id,
			&log.Timestamp,
			&log.Grams_remaining,
		)
		if err != nil {
			return nil, err
		}

		logs = append(logs, struct {
			models.FoodTrackedContainerLogId
			models.FoodTrackedContainerLog
		}{
			FoodTrackedContainerLogId: logId,
			FoodTrackedContainerLog:   log,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return logs, nil
}

func AddFoodToBD(db *sql.DB, payload models.Food, user models.User) (int64, error) {
	tx, err := db.Begin()
	if err != nil {
		return -1, err
	}
	defer tx.Rollback()

	var foodID int64

	err = tx.QueryRow(
		`
		INSERT INTO foods (
			name,
			brand,
			barcode,
			calories_per_100g,
			protein_per_100g,
			fat_per_100g,
			carbs_per_100g
		)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT DO UPDATE SET
			name = excluded.name
		RETURNING id
		`,
		payload.Name,
		payload.Brand,
		payload.Barcode,
		payload.Calories,
		payload.Protein,
		payload.Fat,
		payload.Carbs,
	).Scan(&foodID)

	if err != nil {
		return -1, err
	}

	_, err = tx.Exec(
		`
		INSERT INTO food_owners (user, food_id)
		VALUES (?, ?)
		ON CONFLICT(user, food_id) DO NOTHING
		`,
		user.User,
		foodID,
	)

	if err != nil {
		return -1, err
	}

	return foodID, tx.Commit()
}

func RemoveFoodFromDB(db *sql.DB, payload models.FoodId, user models.User) error {
	result, err := db.Exec(
		`
		DELETE FROM food_owners
		WHERE food_id = ? AND user = ? AND NOT EXISTS (
			SELECT 1 FROM food_log WHERE food_id = ? AND user = ?
		)
		AND NOT EXISTS (
			SELECT 1 FROM tracked_food_containers WHERE food_id = ? AND user = ?
		)
	`, payload.Food_id, user.User, payload.Food_id, user.User, payload.Food_id, user.User)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("user does not own this food")
	}

	return nil
}

func AddFoodLogToDB(db *sql.DB, payload models.FoodLog, user models.User) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO food_log (
			user,
			timestamp,
			food_id,
			grams
		)
		SELECT ?, ?, ?, ?
		WHERE EXISTS (
			SELECT 1
			FROM food_owners
			WHERE user = ? AND food_id = ?
		)
	`,
		user.User,
		payload.Timestamp,
		payload.Food_id,
		payload.Grams,
		user.User,
		payload.Food_id,
	)
	if err != nil {
		return -1, err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return -1, err
	}

	if rows == 0 {
		return -1, errors.New("user doesn't have this food")
	}

	return result.LastInsertId()
}

func RemoveFoodLogFromDB(db *sql.DB, payload models.FoodLogId, user models.User) error {
	result, err := db.Exec(
		`
		DELETE FROM food_log
		WHERE id = ? AND user = ?
	`, payload.Log_id, user.User)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("food log not found")
	}

	return nil
}

func AddTrackedFoodContainerToDB(db *sql.DB, payload models.FoodTrackedContainer, user models.User) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO tracked_food_containers (
			user,
			food_id,
			started_at,
			start_weight,
			label
		)
		SELECT ?, ?, ?, ?, ?
		WHERE EXISTS (
			SELECT 1
			FROM food_owners
			WHERE user = ? AND food_id = ?
		)
	`,
		user.User,
		payload.Food_id,
		payload.Started_at,
		payload.Start_weight,
		payload.Label,
		user.User,
		payload.Food_id,
	)
	if err != nil {
		return -1, err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return -1, err
	}

	if rows == 0 {
		return -1, errors.New("user doesn't have this food")
	}

	return result.LastInsertId()
}

func RemoveTrackedFoodContainerFromDB(db *sql.DB, payload models.FoodTrackedContainerId, user models.User) error {
	result, err := db.Exec(
		`
		DELETE FROM tracked_food_containers
		WHERE id = ? AND user = ? 
		AND NOT EXISTS (
			SELECT 1 FROM tracked_food_measurements WHERE container_id = ? AND user = ?
		)
	`, payload.Tracked_container_id, user.User, payload.Tracked_container_id, user.User)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("tracked food container not found or has measurements")
	}

	return nil
}

func AddTrackedFoodContainerLogToDB(db *sql.DB, payload models.FoodTrackedContainerLog, user models.User) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO tracked_food_measurements (
			user,
			container_id,
			timestamp,
			grams_remaining
		)
		SELECT ?, ?, ?, ?
		WHERE EXISTS (
			SELECT 1
			FROM tracked_food_containers
			WHERE user = ? AND id = ?
		)
	`,
		user.User,
		payload.Tracked_container_id,
		payload.Timestamp,
		payload.Grams_remaining,
		user.User,
		payload.Tracked_container_id,
	)
	if err != nil {
		return -1, err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return -1, err
	}

	if rows == 0 {
		return -1, errors.New("user doesn't have this food")
	}

	return result.LastInsertId()
}

func RemoveTrackedFoodContainerLogFromDB(db *sql.DB, payload models.FoodTrackedContainerLogId, user models.User) error {
	result, err := db.Exec(
		`
		DELETE FROM tracked_food_measurements
		WHERE id = ? AND user = ?
	`, payload.Tracked_container_log_id, user.User)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("tracked food log not found")
	}

	return nil
}
