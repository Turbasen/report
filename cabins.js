'use strict';

const opts = require('nomnom')
  .option('output', {
    help: 'CSV file output path',
    default: './cabins.csv',
    required: true,
  })
  .option('ntb-api-env', {
    help: 'API environment',
    choices: ['api', 'dev'],
    default: 'dev',
  })
  .option('version', {
    flag: true,
    help: 'Print version and exit',
    callback: function() {
       return 'Version 1.0.0';
    }
  })
  .help('Utility to manage cabins without associated owner groups')
  .parse();

process.env.NTB_API_ENV = opts['ntb-api-env'];
const turbasen = require('turbasen');
const CSV = require('comma-separated-values');
const write = require('fs').writeFileSync;

const query = {
  fields: 'navn,betjeningsgrad,geojson,privat',
  'tags.0': 'Hytte',
  'privat.hytteeier': 'DNT',
  'sort': 'navn',
};

const cabins = [];
const groups = new Map();

turbasen.grupper.each({}, (group, next) => {
  groups.set(group._id, group.navn);
  next();
}, (err) => {
  if (err) { throw err; }

  turbasen.steder.each(query, (item, next) => {
    item.privat = item.privat || {};
    item.privat.senger = item.privat.senger || {};

    item.geojson = item.geojson || {};
    item.geojson.coordinates = item.geojson.coordinates || [-999, -999];

    const cabin = {
      id: item._id,
      navn: item.navn,
      longitude: item.geojson.coordinates[0],
      latitude: item.geojson.coordinates[1],
      betjening: item.betjeningsgrad,
      eier: groups.get(item.privat.juridisk_eier) || '',
      driver: groups.get(item.privat.vedlikeholdes_av) || '',
      senger_vinter: item.privat.senger.vinter,
      senger_ubetjent: item.privat.senger.ubetjent,
      senger_selvbetjent: item.privat.senger.selvbetjent,
      senger_betjent: item.privat.senger.betjent,
      url: `http://www.ut.no/hytte/${item._id}`,
    };

    cabins.push(cabin);

    next();
  }, (err) => {
    if (err) { throw err; }

    const csv = new CSV(cabins, { header: true }).encode();
    write(opts.output, csv);
  });
});

process.on('SIGINT', process.exit.bind(process, 1));
