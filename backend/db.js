
  const { MongoClient } = require('mongodb');

  const mongoUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const databaseName = process.env.MONGODB_DB || 'smartschool_db';
  const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 5000 });
  let connection;

  async function connect() {
    if (!connection) {
      connection = client.connect().then(async () => {
        const database = client.db(databaseName);
        await Promise.all([
          database.collection('users').createIndex({ username: 1 }, { unique: true }),
          database.collection('attendance').createIndex({ teacher_id: 1, status_time: 1 }),
          database.collection('attendance').createIndex({ action: 1, status_time: 1, teacher_id: 1 }),
          database.collection('attendance').createIndex({ status_time: 1, teacher_id: 1 }),
          database.collection('teachers').createIndex({ id: 1 }, { unique: true })
        ]);
        return database;
      }).catch((error) => {
        connection = null;
        throw error;
      });
    }
    return connection;
  }

  async function nextId(collectionName) {
    const database = await connect();
    const counter = await database.collection('counters').findOneAndUpdate(
      { _id: collectionName },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    return counter.sequence;
  }

  module.exports = { client, connect, nextId, mongoUrl, databaseName };
