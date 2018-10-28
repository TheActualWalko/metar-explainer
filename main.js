const unknownsSeen = {};

let unknownTimeout;
const sawUnknown = (x, metar) => {
  if (!unknownsSeen[x]) {
    if (unknownTimeout) {
      clearTimeout(unknownTimeout);
    }
    unknownTimeout = setTimeout(() => {
      unknownsSeen[x] = true;
      console.log('would track', `"${x}" from metar "${metar}"`);
      // $.ajax({
      //   method: 'POST',
      //   url: 'unknown',
      //   data: `"${x}" from metar "${metar}"`,
      //   success: () => {
      //     console.log('tracked unknown', x);
      //   }
      // });
    }, 1500);
  }
}

const input = $('#input');
const output = $('#output');

const cloudTypeMap = {
  AC: 'altocumulus',
  CI: 'cirrus',
};

const cloudCoverageMap = {
  FEW: 'A few clouds',
  SCT: 'Scattered clouds',
  BKN: 'Broken clouds',
  OVC: 'Overcast'
}

const capitalize = (x) => x[0].toUpperCase() + x.slice(1);

const getActualSLP = (slp) => slp > 500 ? 900 + (slp/10) : 1000 + (slp/10)

const interpreters = [
  [
    (x) => /^METAR$/.exec(x),
    () => 'Meteorological Aerodrome Report.'
  ],
  [
    (x) => /^SPECI$/.exec(x),
    () => 'Special weather report due to a significant change in conditions.'
  ],
  [
    (x, index) => (index === 1 || index === 0) && (x.length === 4 || x.length === 3) ? x : null,
    (component) => `For airport ${component}.`
  ],
  [
    (x) => /^(\d\d)(\d\d)(\d\d)Z$/.exec(x),
    ([_, date, hours, minutes]) =>
      `Reported on day ${parseInt(date)} of the month, at ${parseInt(hours)}:${minutes} UTC.`
  ],
  [
    (x) => /^(\d\d\d)(\d\d)(KT|MPS)$/.exec(x),
    ([_, direction, speed, unit]) =>
      `Wind heading ${parseInt(direction)} degrees at ${parseInt(speed)} ${unit === 'KT' ? 'knots' : 'metres per second'}.`
  ],
  [
    (x) => /^([\d\/\d]*)SM$/.exec(x),
    ([_, distance]) => `Visibility distance of ${distance} of a statute mile.`
  ],
  [
    (x) => /^([\d\/]*)SM$/.exec(x),
    ([_, distance]) => `Visibility distance of ${parseInt(distance)} statute mile${parseInt(distance) === 1 ? '' : 's'}.`
  ],
  [
    (x) => /^(FEW|SCT|BKN|OVC)(\d\d\d)$/.exec(x),
    ([_, cloudCoverage, altitude]) => `${cloudCoverageMap[cloudCoverage]} at ${parseInt(altitude) * 100} feet.`
  ],
  [
    (x) => /^(M?\d\d)\/(M?\d\d)$/.exec(x),
    ([_, temp, dewPoint]) => `Sea level air temperature ${parseInt(temp.replace('M','-'))}°, dew point ${parseInt(dewPoint.replace('M','-'))}°.`
  ],
  [
    (x) => /^A(\d\d\d\d)$/.exec(x),
    ([_, inHg]) => `Current altimeter setting is ${(parseInt(inHg)/100).toFixed(2)} inHg, or ${(parseInt(inHg) * 0.338639).toFixed(0)} hPa.`
  ],
  [
    (x) => /^Q(\d\d\d\d)$/.exec(x),
    ([_, hPa]) => `Current altimeter setting is ${hPa} hPa, or ${(parseInt(hPa)/33.8639).toFixed(2)} inHg.`
  ],
  [
    (x) => x === 'RMK' ? x : null,
    () => 'Additional remarks to follow'
  ],
  [
    (x) => /^(AC|CI)1?(AC|CI)1?$/.exec(x),
    ([_, cloudType1, cloudType2]) => `${capitalize(cloudTypeMap[cloudType1])} and ${cloudTypeMap[cloudType2]} clouds present.`
  ],
  [
    (x) => /^(AC|CI)1?$/.exec(x),
    ([_, cloudType]) => `${capitalize(cloudTypeMap[cloudType])} clouds present.`
  ],
  [
    (x) => /^SLP(\d\d\d).?$/.exec(x),
    ([_, seaLevelPressure]) => `Sea level pressure is ${getActualSLP(seaLevelPressure).toFixed(1)} hPa.`
  ],

  // Community-suggested interpretations
  [
    (x) => x === 'SKC' ? x : null,
    ([]) => `No cloud/Sky clear. In North America, indicates a human-generated report.`
  ],
  [
    (x) => x === 'CAVOK' ? x : null,
    ([]) => `Ceiling/clouds and visibility are OK.`
  ],
  [
    (x) => x === 'NOSIG' ? x : null,
    ([]) => `No significant changes from last METAR.`
  ],
  [
    (x) => x === 'AUTO' ? x : null,
    ([]) => `This METAR filed automatically by a computer.`
  ],
  [
    (x) => x,
    (x, _, fullMetar) => {
      sawUnknown(x, fullMetar);
      return 'Unknown!'
    }
  ],
];

const interpretComponent = (component, index, metar) => {
  let result;
  interpreters.forEach(([getter, explainer]) => {
    if (result) return;
    const match = getter(component.toUpperCase(), index);
    result = match && explainer(match, index, metar);
  });
  return result;
}

const getMetarBits = (metar) => metar
  .split(/\s/)
  .filter(Boolean)
  .map((component, index) => [component, interpretComponent(component, index, metar)]);

const renderMetarBits = (bits) => output
  .empty()
  .removeClass('hidden')
  .append(
    bits
      .map(([component, definition]) => `<dt>${component}</dt><dd>${definition}</dd>`)
      .join('')
  );

const showEmpty = () => output.empty().addClass('hidden');

input.on('change keyup', () => {
  const value = input.val();
  if (!value) {
    showEmpty();
  } else {
    renderMetarBits(getMetarBits(value));
  }
});

showEmpty();



if (window.location.hash) {
  const value = decodeURIComponent(window.location.hash.slice(1));
  $('#input').val(value);
  renderMetarBits(getMetarBits(value))
}
