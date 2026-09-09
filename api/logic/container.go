package logic

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/HasselAssel/Fettsack/api/models"
)

func EnsureContainerTables(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		CREATE TABLE IF NOT EXISTS tracked_containers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,

			name TEXT,

			started_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS tracked_container_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,
			container_id INTEGER NOT NULL,

			timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
			grams_remaining REAL NOT NULL CHECK (grams_remaining >= 0),

			FOREIGN KEY (container_id) REFERENCES tracked_containers(id)
		);

		CREATE TABLE IF NOT EXISTS tracked_container_ingredients (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			user TEXT NOT NULL,
			container_id INTEGER NOT NULL,

			food_id INTEGER NOT NULL,

			start_weight REAL NOT NULL CHECK (start_weight > 0),
			
			FOREIGN KEY (container_id) REFERENCES tracked_containers(id) ON DELETE CASCADE,
			FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
		);
	`)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func GetTrackedContainersFromDB(db *sql.DB, user models.User) ([]struct {
	models.TrackedContainerId
	models.TrackedContainer
}, error) {
	rows, err := db.Query(`
		SELECT
			id,
			name,
			started_at
		FROM tracked_containers
		WHERE user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var containers []struct {
		models.TrackedContainerId
		models.TrackedContainer
	}

	for rows.Next() {
		var containerId models.TrackedContainerId
		var container models.TrackedContainer

		err := rows.Scan(
			&containerId.Tracked_container_id,
			&container.Name,
			&container.Started_at,
		)
		if err != nil {
			return nil, err
		}

		containers = append(containers, struct {
			models.TrackedContainerId
			models.TrackedContainer
		}{
			TrackedContainerId: containerId,
			TrackedContainer:   container,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return containers, nil
}

func GetTrackedContainerLogsFromDB(db *sql.DB, user models.User) ([]struct {
	models.TrackedContainerLogId
	models.TrackedContainerLog
}, error) {
	rows, err := db.Query(`
		SELECT
			id,
			container_id,
			timestamp,
			grams_remaining
		FROM tracked_container_logs
		WHERE user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []struct {
		models.TrackedContainerLogId
		models.TrackedContainerLog
	}

	for rows.Next() {
		var logId models.TrackedContainerLogId
		var log models.TrackedContainerLog

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
			models.TrackedContainerLogId
			models.TrackedContainerLog
		}{
			TrackedContainerLogId: logId,
			TrackedContainerLog:   log,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return logs, nil
}

func GetTrackedContainerIngredientsFromDB(db *sql.DB, user models.User) ([]struct {
	models.TrackedContainerIngredientId
	models.TrackedContainerIngredient
}, error) {
	rows, err := db.Query(`
		SELECT
			id,
			container_id,
			food_id,
			start_weight
		FROM tracked_container_ingredients
		WHERE user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ingredients []struct {
		models.TrackedContainerIngredientId
		models.TrackedContainerIngredient
	}

	for rows.Next() {
		var ingredientId models.TrackedContainerIngredientId
		var ingredient models.TrackedContainerIngredient

		err := rows.Scan(
			&ingredientId.Tracked_container_ingredient_id,
			&ingredient.Tracked_container_id,
			&ingredient.Food_id,
			&ingredient.Grams_start,
		)
		if err != nil {
			return nil, err
		}

		ingredients = append(ingredients, struct {
			models.TrackedContainerIngredientId
			models.TrackedContainerIngredient
		}{
			TrackedContainerIngredientId: ingredientId,
			TrackedContainerIngredient:   ingredient,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return ingredients, nil
}

func AddTrackedContainerToDB(db *sql.DB, payload models.TrackedContainer, user models.User) (int64, error) {
	result, err := db.Exec(
		`
			INSERT INTO tracked_containers (
				user,
				name,
				started_at
			)
			VALUES (?, ?, ?);
		`,
		user.User,
		payload.Name,
		payload.Started_at,
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

func RemoveTrackedContainerFromDB(db *sql.DB, payload models.TrackedContainerId, user models.User) error {
	result, err := db.Exec(
		`
			DELETE FROM tracked_containers
			WHERE id = ? AND user = ? 
			AND NOT EXISTS (
				SELECT 1 FROM tracked_container_logs
				WHERE container_id = ? AND user = ?
			);
		`,
		payload.Tracked_container_id,
		user.User,
		payload.Tracked_container_id,
		user.User,
	)
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

func AddTrackedContainerLogToDB(db *sql.DB, payload models.TrackedContainerLog, user models.User) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO tracked_container_logs (
			user,
			container_id,
			timestamp,
			grams_remaining
		)
		SELECT ?, ?, ?, ?
		WHERE EXISTS (
			SELECT 1
			FROM tracked_containers
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

func RemoveTrackedContainerLogFromDB(db *sql.DB, payload models.TrackedContainerLogId, user models.User) error {
	result, err := db.Exec(
		`
		DELETE FROM tracked_container_logs
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

func AddTrackedContainerIngredientToDB(db *sql.DB, payload models.TrackedContainerIngredient, user models.User) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO tracked_container_ingredients (
			user,
			container_id,
			food_id,
			start_weight
		)
		SELECT ?, ?, ?, ?
		WHERE EXISTS (
			SELECT 1
			FROM tracked_containers
			WHERE user = ? AND id = ?
		) AND EXISTS (
			SELECT 1
			FROM food_owners
			WHERE user = ? AND food_id = ?
		)
	`,
		user.User,
		payload.Tracked_container_id,
		payload.Food_id,
		payload.Grams_start,
		user.User,
		payload.Tracked_container_id,
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

func RemoveTrackedFoodContainerIngredientFromDB(db *sql.DB, payload models.TrackedContainerIngredientId, user models.User) error {
	result, err := db.Exec(
		`
		DELETE FROM tracked_container_ingredients
		WHERE id = ? AND user = ?
	`, payload.Tracked_container_ingredient_id, user.User)
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
