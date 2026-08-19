function toUTC(date = new Date()) {
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

// function toUTC(dateString) {
//   if (!dateString) return null; // Prevent crash

//   const [datePart, timePart] = dateString.split(" ");
//   const [day, month, year] = datePart.split("/");

//   const isoString = `${year}-${month}-${day}T${timePart}Z`;

//   return new Date(isoString).toISOString().slice(0, 19).replace("T", " ");
// }

module.exports = {
  toUTC,
};
