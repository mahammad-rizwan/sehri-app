const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const seq = new Sequelize('sehri_connect', 'root', '866572', {
  host: 'localhost', port: 3306, dialect: 'mysql'
});
(async () => {
  try {
    const hash = await bcrypt.hash('pass@123', 10);
    await seq.query("UPDATE super_admins SET password = ? WHERE phone = '9483384972'", { replacements: [hash] });
    console.log('SuperAdmin password reset to: pass@123');
    await seq.close();
  } catch (e) { console.error(e.message); }
})();
