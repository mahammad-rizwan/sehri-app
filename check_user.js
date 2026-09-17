const { Sequelize } = require('sequelize');
const seq = new Sequelize('sehri_connect', 'root', '866572', {
  host: 'localhost', port: 3306, dialect: 'mysql'
});
(async () => {
  try {
    const [u] = await seq.query("SELECT id, phone, name FROM users WHERE phone = '9483384972'");
    console.log('Users:', u.length ? JSON.stringify(u[0]) : 'NOT FOUND');
    const [a] = await seq.query("SELECT id, phone, name, role FROM admins WHERE phone = '9483384972'");
    console.log('Admins:', a.length ? JSON.stringify(a[0]) : 'NOT FOUND');
    const [s] = await seq.query("SELECT id, phone, name FROM super_admins WHERE phone = '9483384972'");
    console.log('SuperAdmins:', s.length ? JSON.stringify(s[0]) : 'NOT FOUND');
    await seq.close();
  } catch (e) { console.error(e.message); }
})();
