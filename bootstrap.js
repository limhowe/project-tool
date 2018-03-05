global.fs     = require('fs');
global.Q      = require('q');
global.async  = require('async');
global.moment = require('moment');
global.debug  = require('debug');
global.AWS    = require('aws-sdk');
global._      = require('lodash');

global.APP_PATH = __dirname + '/';
global.APP_ENV = process.env.NODE_ENV || 'development';

global.config = require('nconf').argv().env().file({ file: 'configs/' + APP_ENV + '.json' });

AWS.config.accessKeyId = config.get('aws').id;
AWS.config.secretAccessKey = config.get('aws').key;

global.Helpers = require(APP_PATH + 'helpers');
global.Middlewares = require(APP_PATH + 'middlewares');
global.Models = require(APP_PATH + 'models')();
global.Iz = Helpers.validator;
global.stripe = require('stripe')(config.get('payment:options:api_key'));
