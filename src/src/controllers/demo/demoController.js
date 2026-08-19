

const checkDemoServer = (req, res) => {
    res.status(200).json({ message: "✅ Hello, server is running!" });
};

module.exports = { checkDemoServer };
  