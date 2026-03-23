const Joi = require("joi");

const createAddressSchema = (req, res, next) => {
  const schema = Joi.object().keys({
    address: Joi.string().min(10).max(200).required(),
    city: Joi.string().min(3).max(20).required(),
    pincode: Joi.number().integer().required(),
    state: Joi.string().min(3).max(20).required(),
    type: Joi.string().valid("HOME", "OFFICE"),
  });

  req.schema = schema;

  next();
};

const updateAddressSchema = (req, res, next) => {
  const schema = Joi.object().keys({
    address: Joi.string().min(10).max(200).optional(),
    city: Joi.string().min(3).max(20).optional(),
    pincode: Joi.number().integer().optional(),
    state: Joi.string().min(3).max(20).optional(),
    type: Joi.string().valid("HOME", "OFFICE").optional(),
  });

  req.schema = schema;

  next();
};

const deleteAddressSchema = (req, res, next) => {
  const schema = Joi.object().keys({});

  req.schema = schema;

  next();
};

module.exports = {
  createAddressSchema,
  updateAddressSchema,
  deleteAddressSchema,
};
