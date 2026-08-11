try {
  const d = new Date(undefined);
  d.setHours(23, 59, 59, 999);
  console.log('No error');
} catch(e) {
  console.log('Error: ' + e);
}
