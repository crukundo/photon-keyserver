'use strict'

const keyDao = require('./src/dao/key')
const userDao = require('./src/dao/user')
const twilio = require('./src/service/twilio')
const dynamo = require('./src/service/dynamodb')
const { ops, isOp, isPhone, isCode, isId, isPin } = require('./src/lib/verify')
const { path, body, query, response, error } = require('./src/lib/http')

dynamo.init()
twilio.init()

exports.createKey = async (event) => {
  try {
    const { phone, pin } = body(event)
    if (!isPhone(phone) || (pin && !isPin(pin))) {
      return error(400, 'Invalid request')
    }
    const user = await userDao.getVerified({ phone })
    if (user) {
      return response(201, { id: keyDao.createDummy() })
    }
    const id = await keyDao.create()
    const code = await userDao.create({ phone, keyId: id, pin })
    await twilio.send({ phone, code })
    return response(201, { id })
  } catch (err) {
    return error(500, 'Error creating key', err)
  }
}

exports.getKey = async (event) => {
  try {
    const { keyId } = path(event)
    const { phone } = query(event)
    if (!isId(keyId) || !isPhone(phone)) {
      return error(400, 'Invalid request')
    }
    const code = await userDao.setNewCode({ phone, keyId, op: ops.READ })
    if (!code) {
      return error(404, 'Invalid params')
    }
    await twilio.send({ phone, code })
    return response(200, 'Success')
  } catch (err) {
    return error(500, 'Error reading key', err)
  }
}

exports.verifyKey = async (event) => {
  try {
    const { keyId } = path(event)
    const { phone, code, op, pin, newPin } = body(event)
    if (
      !isPhone(phone) ||
      !isId(keyId) ||
      !isCode(code) ||
      !isOp(op) ||
      (pin && !isPin(pin)) ||
      (newPin && !isPin(newPin))
    ) {
      return error(400, 'Invalid request')
    }
    const { user, delay } = await userDao.verify({
      phone,
      keyId,
      code,
      op,
      pin,
      newPin
    })
    if (delay) {
      return response(429, { message: 'Rate limit until', delay })
    }
    if (!user) {
      return error(404, 'Invalid params')
    }
    if (op === ops.REMOVE) {
      await userDao.remove({ phone, keyId })
      await keyDao.remove({ id: keyId })
      return response(200, 'Success')
    } else {
      const key = await keyDao.get({ id: keyId })
      return response(200, key)
    }
  } catch (err) {
    return error(500, 'Error verifying key', err)
  }
}

exports.removeKey = async (event) => {
  try {
    const { keyId } = path(event)
    const { phone } = query(event)
    if (!isId(keyId) || !isPhone(phone)) {
      return error(400, 'Invalid request')
    }
    const code = await userDao.setNewCode({ phone, keyId, op: ops.REMOVE })
    if (!code) {
      return error(404, 'Invalid params')
    }
    await twilio.send({ phone, code })
    return response(200, 'Success')
  } catch (err) {
    return error(500, 'Error deleting key', err)
  }
}
