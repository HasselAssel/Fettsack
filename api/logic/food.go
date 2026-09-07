package logic

import (
	"github.com/HasselAssel/Fettsack/api/models"
	"database/sql"
	"fmt"
	"errors"

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

			container_id INTEGER NOT NULL,
			timestamp INTEGER NOT NULL DEFAULT (unixepoch()),

			grams_remaining REAL NOT NULL CHECK (grams_remaining >= 0),

			FOREIGN KEY (container_id)
				REFERENCES tracked_food_containers(id)
				ON DELETE CASCADE
		);
	`)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func GetFoodsFromDB(db *sql.DB, user models.User) ([]struct{models.FoodId; models.Food}, error) {
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

	var foods []struct{models.FoodId; models.Food}

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

		foods = append(foods, struct{models.FoodId; models.Food}{
			FoodId: foodId,
			Food: food,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return foods, nil
}

func GetLogsFromDB(db *sql.DB, user models.User) ([]struct{models.FoodLogId; models.FoodLog}, error) {
	rows, err := db.Query(`
		SELECT
			fl.id,
			fl.food_id,
			fl.timestamp,
			fl.grams
		FROM food_log fl
		WHERE fl.user = ?
	`, user.User)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []struct{models.FoodLogId; models.FoodLog}

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

		logs = append(logs, struct{models.FoodLogId; models.FoodLog}{
			FoodLogId: logId,
			FoodLog: log,
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
	`, payload.Food_id, user.User, payload.Food_id, user.User)
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

func RemoveFoodLogFromDB(db *sql.DB, payload models.FoodLogId, user models.User) (error) {
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
		return fmt.Errorf("log not found")
	}

	return nil
}


/*_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS recipes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL
		UNIQUE (name)
	);
`)
if err != nil {
	return err
}
_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS recipe_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,

		recipe_id INTEGER NOT NULL,

		ingredients_id INTEGER,
		child_recipe_id INTEGER,

		FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
		FOREIGN KEY (ingredients_id) REFERENCES ingredients(id),
		FOREIGN KEY (child_recipe_id) REFERENCES recipes(id),

		CHECK (
			(ingredients_id IS NOT NULL AND child_recipe_id IS NULL)
			OR
			(ingredients_id IS NULL AND child_recipe_id IS NOT NULL)
		),

		UNIQUE (recipe_id, ingredients_id, child_recipe_id)
	);
`)
if err != nil {
	return err
}*/