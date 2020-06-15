/**
 * @fileOverview represents data access object for reading/writing private key documents from the datastore.
 */

'use strict'

const { v4: uuid } = require('uuid')
const { isId } = require('../lib/verify')
const { generateKey } = require('../lib/crypto')
const dynamo = require('../service/dynamodb')

/**
 * Database documents have the format:
 * {
 *   id: '550e8400-e29b-11d4-a716-446655440000', // a randomly generated UUID
 *   encryptionKey: '6eDnFZxXrYKYyfrz33OqBNeSo3aaLilO+R+my4hYM40=',
 * }
 */
const TABLE = process.env.DYNAMODB_TABLE_KEY

exports.create = async () => {
  const id = uuid()
  const encryptionKey = await generateKey()
  await dynamo.put(TABLE, { id, encryptionKey })
  return id
}

exports.createDummy = () => uuid()

exports.get = async ({ id }) => {
  if (!isId(id)) {
    throw new Error('Invalid args')
  }
  return dynamo.get(TABLE, { id })
}

exports.remove = async ({ id }) => {
  if (!isId(id)) {
    throw new Error('Invalid args')
  }
  return dynamo.remove(TABLE, { id })
}
