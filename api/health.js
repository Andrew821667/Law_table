module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    message: 'Vercel works!',
    timestamp: new Date().toISOString()
  });
};
