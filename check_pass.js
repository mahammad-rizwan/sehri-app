const bcrypt = require('bcryptjs');
const { Sequelize } = require('sequelize');
const seq = new Sequelize('sehri_connect', 'root', '866572', {
  host: 'localhost', port: 3306, dialect: 'mysql'
});
(async () => {
  try {
    const [u] = await seq.query("SELECT id, phone, name, password FROM users WHERE phone = '9483384972'");
    if (u.length) {
      console.log('User:', u[0].name, '-', u[0].phone);
      console.log('Password hash:', u[0].password);
      const match = await bcrypt.compare('pass@123', u[0].password);
      console.log('pass@123 matches:', match);
      const match2 = await bcrypt.compare('Rizwan@2004', u[0].password);
      console.log('Rizwan@2004 matches:', match2);
    } else {
      console.log('User not found');
    }
    const [s] = await seq.query("SELECT id, phone, name, password FROM super_admins WHERE phone = '9483384972'");
    if (s.length) {
      console.log('SuperAdmin:', s[0].name);
      console.log('Password hash:', s[0].password);
      const match = await bcrypt.compare('Rizwan@2004', s[0].password);
      console.log('Rizwan@2004 matches:', match);
    } else {
      console.log('SuperAdmin not found');
    }
    await seq.close();
  } catch (e) { console.error(e.message); }
})();
