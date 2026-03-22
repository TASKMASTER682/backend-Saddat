require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function createNode(name, fatherId = null) {
  return await User.create({
    name,
    fatherId,
    isStatic: true,
    isAlive: false,
    role: 'ancestor',
  });
}

async function createChain(names, parentId = null) {
  let prev = parentId;

  for (const name of names) {
    const node = await createNode(name, prev);
    prev = node._id;
  }

  return prev;
}

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ DB Connected');

  await User.deleteMany({});

  // ==============================
  // 🔥 MAIN LINEAGE (CHAIN)
  // ==============================
  const lastAncestor = await createChain([
    'Hazrat Imam Ali',
    'Sayed Hassan',
    'Sayed Hassan al-Mutahanna',
    'Sayed Abdullah al Mahz',
    'Sayed Musa al June',
    'Sayed Abdullah',
    'Sayed Musa',
    'Sayed Dawood',
    'Sayed Mohammed',
    'Sayed Zahid',
    'Sayed Yahya',
    'Sayed Abdullah',
    'Sayed Musa',
    'Sayed Saleh Musa Jangi Dost',
    'Sayed Mohiyuddin Abdul Qadir Jilani',
    'Sayed Abdul Wahab',
    'Sayed Moenuddin Mamduh',
    'Sayed Abdullah',
    'Sayed Mehmood',
    'Sayed Abdul Basit',
    'Sayed Abdul Qadir Sani',
    'Sayed Hussain',
    'Sayed Shahabuddin',
    'Sayed Sharafuddin',
    'Sayed Qasim Mohummad',
    'Sayed Mohd Yahya',
    'Sayed Badruddin',
    'Sayed Alauddin',
    'Sayed Shamsuddin',
    'Sayed Mohammed Yahya',
    'Sayed Abdul Rehman (Sakhi Rindan Shah)',
    'Sayed Mohammed Razaq Shah',
  ]);

  // ==============================
  // 🌳 ROOT AFTER LINEAGE
  // ==============================
  const root = await createNode(
    'Sayed Ghulam Mohiyuddin Shah',
    lastAncestor
  );

  // ==============================
  // 🔥 LEVEL 1 (SONS)
  // ==============================
  const mubarak = await createNode('Sayed Mubarak Shah', root._id);
  const siddique = await createNode('Sayed Siddique Shah', root._id);
  const ameerAli = await createNode('Sayed Ameer Ali Shah', root._id);
  const sarfaraz = await createNode('Sayed Sarfaraz Shah', root._id);
  const gulab = await createNode('Sayed Gulab Shah', root._id);
  await createNode('Sayed Masoom (La Walad)', root._id);

  // ==============================
  // 🔥 MUBARAK BRANCH
  // ==============================
  const haider = await createNode('Sayed Haider Shah', mubarak._id);
  const mehboob = await createNode('Sayed Mehboob Shah', mubarak._id);

  // ==============================
// 🔥 SIDDIQUE BRANCH (FIXED)
// ==============================
await createNode('Sayed Ghulam Murtaza', siddique._id);
await createNode('Sayed Lal Shah', siddique._id);
await createNode('Sayed Mastan Shah', siddique._id);
await createNode('Sayed Maqbool Shah', siddique._id);
await createNode('Sayed Akbar Shah', siddique._id);

// ==============================
// 🔥 AMEER ALI BRANCH (FIXED)
// ==============================
await createNode('Sayed Masoom Shah', ameerAli._id);
await createNode('Sayed Hussain Shah', ameerAli._id);
await createNode('Sayed Pehalwan Shah', ameerAli._id);
  // ==============================
  // 🔥 SARFARAZ BRANCH
  // ==============================
  const dilawar = await createNode('Sayed Dilawar Shah', sarfaraz._id);
  await createNode('Sayed Abbas Ali Shah', dilawar._id);
  await createNode('Sayed Yaseen Shah', dilawar._id);

  // ==============================
  // 🔥 GULAB BRANCH
  // ==============================
  await createNode('Sayed Rasool Shah (La Walad)', gulab._id);

  // ==============================
  // 🧬 HAIDER SONS
  // ==============================
  await createNode('Sayed Jafar Shah', haider._id);
  await createNode('Sayed Gayasuddin Shah', haider._id);
  await createNode('Sayed Noor Shah', haider._id);
  await createNode('Sayed Ghulam Shah', haider._id);

  // ==============================
  // 🧬 MEHBOOB SONS
  // ==============================
  await createNode('Sayed Gulzar Shah', mehboob._id);
  await createNode('Sayed Wilayat Shah', mehboob._id);
  await createNode('Sayed Ghulab Shah', mehboob._id);
  await createNode('Sayed Yousaf Shah', mehboob._id);
  await createNode('Sayed Noor Hassan Shah', mehboob._id);

  console.log('🔥 FULL COMBINED SHAJRA SEEDED');
  await mongoose.disconnect();
}

seed();