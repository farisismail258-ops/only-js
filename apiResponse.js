'use strict';

/**
 * Consistent API response helpers.
 * Every endpoint returns { success, data?, error?, meta? }
 */

exports.ok = (res, data, meta) => {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return res.status(200).json(payload);
};

exports.created = (res, data) =>
  res.status(201).json({ success: true, data });

exports.badRequest = (res, message, errors) =>
  res.status(400).json({ success: false, error: message, ...(errors && { errors }) });

exports.unauthorized = (res, message = 'Unauthorised') =>
  res.status(401).json({ success: false, error: message });

exports.notFound = (res, message = 'Not found') =>
  res.status(404).json({ success: false, error: message });

exports.serverError = (res, message = 'Internal server error') =>
  res.status(500).json({ success: false, error: message });
