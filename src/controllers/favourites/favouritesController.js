const { queryDatabase } = require('../../config/db');
const { TABLES } = require('../../config/tables');

// Add to favorites
const addFavorite = async (req, res) => {
  try {
    // const user_id = req.user?.id;
    const { user_id, symbol } = req.body;

    console.log("ADD FAVORITE -> user_id:", user_id, "symbol:", symbol);

    if (!user_id || !symbol) {
      return res.status(400).json({ message: "user_id and symbol are required" });
    }

    // check if already added
    const [existing] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_FAVOURITES} WHERE user_id = ? AND symbol = ?`,
      [user_id, symbol]
    );

    console.log("Existing rows:", existing);

    if (existing.length > 0) {
      return res.status(409).json({ message: "Already in favorites" });
    }

    await queryDatabase(
      `INSERT INTO ${TABLES.LIVE_FAVOURITES} (user_id, symbol) VALUES (?, ?)`,
      [user_id, symbol]
    );

    res.json({ success: true, message: "Added to favorites" });
  } catch (err) {
    console.error("Error in addFavorite:", err);
    res.status(500).json({ message: "Added Server error" });
  }
};

// Remove from favorites
const removeFavorite = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { symbol } = req.body;

    await queryDatabase(`DELETE FROM ${TABLES.LIVE_FAVOURITES} WHERE user_id = ? AND symbol = ?`, [
      user_id,
      symbol,
    ]);

    res.json({ success: true, message: "Removed from favorites" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Removed Server error" });
  }
};

// Get user's favorites
const getFavorites = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [favRows] = await queryDatabase(
      `SELECT * FROM ${TABLES.LIVE_FAVOURITES} WHERE user_id = ? ORDER BY created_at DESC`,
      [user_id]
    );

    // Get active spreads
    const [spreadRows] = await queryDatabase(
      `SELECT symbol FROM ${TABLES.ADMIN_SPREAD} WHERE status = 'active'`
    );

    const activeSpreadSet = new Set(spreadRows.map(r => r.symbol.replace("/", "").toUpperCase()));

    const validFavorites = favRows.filter(fav =>
      activeSpreadSet.has(fav.symbol.toUpperCase())
    );

    // Remove inactive favorites from DB
    const inactiveFavorites = favRows.filter(fav =>
      !activeSpreadSet.has(fav.symbol.toUpperCase())
    );

    if (inactiveFavorites.length > 0) {
      const placeholders = inactiveFavorites.map(() => "?").join(",");
      await queryDatabase(
        `DELETE FROM ${TABLES.LIVE_FAVOURITES} WHERE user_id = ? AND symbol IN (${placeholders})`,
        [user_id, ...inactiveFavorites.map(f => f.symbol)]
      );
    }

    return res.json({ success: true, favorites: validFavorites });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};


module.exports = {
  addFavorite,
  removeFavorite,
  getFavorites,
};
