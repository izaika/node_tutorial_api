module.exports = {
  phone: str => typeof str === 'string' && str.trim().length === 10,
};
