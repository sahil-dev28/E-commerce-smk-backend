const { StatusCodes } = require("http-status-codes");

const prisma = require("../../prisma/prisma-client");

const CustomError = require("../errors");
const customUtils = require("../utils");
const modelMethods = require("../model-methods");

const register = async (req, res) => {
  delete req.body.role;
  const verificationToken = customUtils.createRandomBytes();
  console.log({ verificationToken });

  const userModel = new modelMethods.User({
    ...req.body,
    verificationToken: customUtils.hashString(verificationToken),
  });

  await userModel.encryptPassword();

  const user = await prisma.user.create({
    data: userModel.model,
  });

  await customUtils.sendVerificationEmail({
    name: user.firstName,
    email: user.email,
    verificationToken,
    origin: req.header("Origin"),
  });

  res.status(StatusCodes.CREATED).json({
    msg: `Email verification link sent to ${user.email}`,
  });
};

const adminRegister = async (req, res) => {
  req.body.role = "ADMIN";
  const verificationToken = customUtils.createRandomBytes();
  console.log({ verificationToken });

  const userModel = new modelMethods.User({
    ...req.body,
    verificationToken: customUtils.hashString(verificationToken),
  });

  await userModel.encryptPassword();

  const user = await prisma.user.create({
    data: userModel.model,
  });

  await customUtils.sendVerificationEmail({
    name: user.firstName,
    email: user.email,
    verificationToken,
    origin: req.header("Origin"),
  });

  res.status(StatusCodes.CREATED).json({
    msg: `Email verification link sent to ${user.email}`,
  });
};

const verify = async (req, res) => {
  const { email, token } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new CustomError.UnauthenticatedError("Verification failed");
  }

  if (user.isVerified) {
    throw new CustomError.BadRequestError("Already verified");
  }

  new modelMethods.User(user).compareVerificationToken(
    customUtils.hashString(token)
  );

  await prisma.user.update({
    data: {
      isVerified: true,
      verified: customUtils.currentTime(),
      verificationToken: null,
    },
    where: {
      email,
    },
  });

  res.status(StatusCodes.OK).json({ msg: "Email verified successfully" });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new CustomError.NotFoundError(
      `${email} does not exist, please register`
    );
  }

  new modelMethods.User(user).checkPasswordTokenValidity();

  const passwordToken = customUtils.createRandomBytes();
  console.log({ passwordToken });

  const tenMinutes = 1000 * 60 * 10;
  const passwordTokenExpiration = Date.now() + tenMinutes;

  await prisma.user.update({
    data: {
      passwordToken: customUtils.hashString(passwordToken),
      passwordTokenExpiration: customUtils.time(passwordTokenExpiration),
    },
    where: {
      email,
    },
  });

  await customUtils.sendResetPasswordEmail({
    name: user.firstName,
    email: user.email,
    passwordToken,
    origin: req.header("Origin"),
  });

  res
    .status(StatusCodes.OK)
    .json({ msg: `Password reset link sent to ${user.email}` });
};

const resetPassword = async (req, res) => {
  const { token, email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new CustomError.UnauthenticatedError("Verification failed");
  }

  const userModel = new modelMethods.User({
    ...user,
    password,
  });

  userModel.verifyPasswordToken(customUtils.hashString(token));
  await userModel.encryptPassword();

  await prisma.user.update({
    data: {
      password: userModel.model.password,
      passwordToken: null,
      passwordTokenExpiration: null,
    },
    where: {
      email,
    },
  });

  res.status(StatusCodes.OK).json({ msg: "Password changed successfully" });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new CustomError.NotFoundError(
      `${email} does not exist, please register`
    );
  }

  const userModel = new modelMethods.User(user);
  await userModel.comparePassword(password);

  userModel.checkUser();
  userModel.checkAuthorized();

  const tokenUser = customUtils.createTokenUser(user);

  customUtils.attachCookiesToResponse({ res, req, tokenUser });

  res.status(StatusCodes.OK).json({
    userId: user.id,
  });
};

const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new CustomError.NotFoundError(
      `${email} does not exist, please register`
    );
  }

  const userModel = new modelMethods.User(user);

  await userModel.comparePassword(password);

  userModel.checkAdmin();
  userModel.checkAuthorized();

  const tokenUser = customUtils.createTokenUser(user);

  customUtils.attachCookiesToResponse({ res, req, tokenUser });

  res.status(StatusCodes.OK).json({
    userId: user.id,
  });
};

const logout = (req, res) => {
  res.cookie(req.header("Origin"), "logout", {
    httpOnly: true,
    maxAge: 0,
    secure: true,
    signed: true,
    sameSite: "none",
  });

  res.status(StatusCodes.OK).json({
    msg: "Logged out successfully",
  });
};

module.exports = {
  register,
  login,
  verify,
  forgotPassword,
  resetPassword,
  logout,
  adminLogin,
  adminRegister,
};
