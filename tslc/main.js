/* Team Sidney Light Controller - Main Javascript code */

/* Firebase rules are set up to allow public REST access to read
 * the strips entries in the database. The value of a strip with
 * ID "strip3" can be accessed via:
 * 
 * https://team-sidney.firebaseio.com/strips/strip3.json
 *
 * which returns a JSON-encoded string for the value (e.g., "Off"), with
 * the quotes around it.
 */

/* Set to true to stub out authentication code. */
var FAKE_AUTH = false;
var SIDNEY_PHOTO = "http://howtoprof.com/profsidney.jpg";
var provider = new firebase.auth.GoogleAuthProvider();
var fakeUser = null;

// Mapping from strip-ID to object maintaining strip state.
var allStrips = {};

// List of supported modes.
var allmodes = [
  'off',
  'none',
  'wipered',
  'wipeblue',
  'wipegreen',
  'theaterOrange',
  'rainbow',
  'rainbowcycle',
  'spackle',
  'fire',
  'bounce',
];

// Reference to log DB entry.
var logRef = null;

// Initialize click handlers.
$('#login').off('click');
$('#login').click(doLogin);
$('#userinfo').off('click');
$('#userinfo').click(logout);

initEditor();
setup();

function initEditor() {
  console.log('initEditor called');
  var editor = $("#editorMode");

  // Try using a select.
  var select = $('<select/>')
    .appendTo(editor);

  // Add the modes.
  allmodes.forEach(function(mode) {
    $('<option/>')
      .text(mode)
      .click(function() {
        setMode(id, mode)
      })
      .appendTo(select);
  });
  
  // Dropdown as part of editor.
  var dd = $('<div/>')
    .addClass('btn-group')
    .attr('role', 'group')
    .appendTo(editor);

  // Dropdown button itself.
  var ddt = $('<button/>')
    .attr('id', 'editor-mode-button')
    .attr('type', 'button')
    .addClass('btn')
    .addClass('btn-secondary')
    .addClass('dropdown-toggle')
    .attr('data-toggle', 'dropdown')
    .attr('aria-haspopup', 'true')
    .attr('aria-expanded', 'false')
    .text('Mode')
    .appendTo(dd);

  var ddm = $('<div/>')
    .addClass('dropdown-menu')
    .attr('aria-labelledby', 'editor-mode-button')
    .appendTo(dd);

  // Add the modes.
  allmodes.forEach(function(mode) {
    $('<a/>')
      .addClass('dropdown-item')
      .attr('href', '#')
      .text(mode)
      .click(function() {
        setMode(id, mode)
      })
      .appendTo(ddm);
  });

  // Fix up UI components for the rest of the editor.
  $("#editorSpeedSlider").slider({
    orientation: "horizontal",
    range: "min",
    max: 100,
    value: 20,
  });
  $("#editorBrightnessSlider").slider({
    orientation: "horizontal",
    range: "min",
    max: 100,
    value: 20,
  });
  $("#red, #green, #blue").slider({
    orientation: "horizontal",
    range: "min",
    max: 255,
    value: 127,
    slide: refreshSwatch,
    change: refreshSwatch
  });
  $("#red").slider("value", 255);
  $("#green").slider("value", 140);
  $("#blue").slider("value", 60);
}

// Color picker.
function hexFromRGB(r, g, b) {
  var hex = [
    r.toString( 16 ),
    g.toString( 16 ),
    b.toString( 16 )
  ];
  $.each(hex, function( nr, val) {
    if ( val.length === 1 ) {
      hex[nr] = "0" + val;
    }
  });
  return hex.join( "" ).toUpperCase();
}

function refreshSwatch() {
  var red = $("#red").slider("value");
  var green = $("#green").slider("value");
  var blue = $("#blue").slider("value");
  var hex = hexFromRGB(red, green, blue);
  $("#swatch").css("background-color", "#" + hex);
}

// Set up initial UI elements.
function setup() {
  if (currentUser() == null) {
    // Not logged in yet.
    showLoginButton();
    logRef = null;

  } else {
    showFullUI();

    checkinRef = firebase.database().ref('checkin/');
    checkinRef.on('child_added', stripCheckin, dbErrorCallback);
    checkinRef.on('child_changed', stripCheckin, dbErrorCallback);

    logRef = firebase.database().ref('log/');
    logRef.on('child_added', newLogEntry, dbErrorCallback);
  }
}

function currentUser() {
  if (FAKE_AUTH) {
    return fakeUser;
  } else {
    return firebase.auth().currentUser;
  }
}

// Called when there is an error reading the database.
function dbErrorCallback(err) {
  // Ignore the error if not logged in yet.
  if (currentUser() != null) {
    showError($('#dberror'), err.message);
  }
}

// Clear error.
function clearError(elem) {
  elem.text('');
  elem.hide();
}

// Show error.
function showError(elem, msg) {
  elem.text(msg);
  elem.show();
}

// Show the login button.
function showLoginButton() {
  $('#postlogin').hide();
  $('#userphoto').hide();
  $('#login').show();
}

function doLogin() {
  if (FAKE_AUTH) {
    fakeUser = {
      displayName: "Fakey McFakerson",
      photoURL: SIDNEY_PHOTO,
      email: "fake@teamsidney.com",
    };
    showFullUI();
  } else {
    firebase.auth().signInWithPopup(provider).then(function(result) {
    }).catch(function(error) {
      showError($('#loginerror'),
                'Sorry, could not log you in: ' + error.message);
    });
  }
}

// Show the full UI.
function showFullUI() {
  // Update header.
  $('#login').hide();
  $('#userphoto')
     .html("<img class='userphoto' src='" + currentUser().photoURL + "'>");
  $('#userphoto').show();

  $('#postlogin').hide('blind');

  $("#log").empty();
  $("#striplist").empty();

  // Show it.
  $('#postlogin').show('fade', 1000);
}

// Callback invoked when database returns new value for a strip.
function stripCheckin(snapshot) {
  var stripid = snapshot.key;
  updateStrip(stripid, snapshot.val());
}

// Update the given strip with the given data.
function updateStrip(id, stripdata) {
  console.log('updateStrip for ' + id);
  console.log(stripdata);

  var strip = allStrips[id];
  if (strip == null) {
    // This is a new strip.
    strip = createStrip(id);
    if (strip == null) {
      console.log('Bug - Unable to create strip ' + id);
      return;
    }
  }

  strip.curMode = stripdata.mode;
  console.log("Setting strip mode to: " + strip.curMode);
  strip.ip = stripdata.ip;
  strip.lastCheckin = new Date(stripdata.timestamp);

  var e = strip.stripElem;
  $(e).effect('highlight');
  $(e).find('#curMode').text(stripdata.mode);

  if (strip.nextMode != strip.curMode) {
    console.log('No match');
    $(e).find("#loader").show();
  } else {
    console.log('Match, hiding spinner');
    $(e).find("#loader").hide();
  }

  $(e).find('#ip').text(stripdata.ip);
  var m = new moment(strip.lastCheckin);
  dateString = m.format('MMM DD, h:mm:ss a') + ' (' + m.fromNow() + ')';
  $(e).find('#checkin').text(dateString);
}

// Create a strip with the given ID.
function createStrip(id) {
  var container = $('#striplist');
  var strip = $('<div/>')
    .addClass('card')
    .addClass('list-group-item')
    .attr('id', 'stripline-strip-'+id)
    .appendTo(container);
  var cardbody = $('<div/>')
    .addClass('card-body')
    .appendTo(strip);
  $('<h5/>')
    .addClass('card-title')
    .text(id)
    .appendTo(cardbody);

  var tbl = $('<table/>')
    .addClass('table')
    .addClass('table-sm')
    .appendTo(cardbody);
  var tbody = $('<tbody/>')
    .appendTo(tbl);

  var r0 = $('<tr/>')
    .appendTo(tbody);
  $('<td/>')
    .text('Current mode')
    .appendTo(r0);
  $('<td/>')
    .attr('id', 'curMode')
    .text('unknown')
    .appendTo(r0);

  r0 = $('<tr/>')
    .appendTo(tbody);
  $('<td/>')
    .text('Next mode')
    .appendTo(r0);
  var nme = $('<td/>')
    .appendTo(r0);
  $('<span/>')
    .attr('id', 'nextMode')
    .text('unknown')
    .appendTo(nme);
  $('<span/>')
    .attr('id', 'loader')
    .css('position', 'relative')
    .addClass('spinner')
    .appendTo(nme);
  
  var r1 = $('<tr/>')
    .appendTo(tbody);
  $('<td/>')
    .text('Last checkin')
    .appendTo(r1);
  $('<td/>')
    .attr('id', 'checkin')
    .text('unknown')
    .appendTo(r1);

  var r2 = $('<tr/>')
    .appendTo(tbody);
  $('<td/>')
    .text('MAC address')
    .appendTo(r2);
  $('<td/>')
    .attr('id', 'mac')
    .text(id)
    .appendTo(r2);

  var r3 = $('<tr/>')
    .appendTo(tbody);
  $('<td/>')
    .text('IP address')
    .appendTo(r3);
  $('<td/>')
    .attr('id', 'ip')
    .text('unknown')
    .appendTo(r3);

  // Button group.
  var bg = $('<div/>')
    .addClass('btn-group')
    .attr('role', 'group')
    .appendTo(cardbody);

  var edit = $('<button/>')
    .attr('type', 'button')
    .attr('data-toggle', 'modal')
    .attr('data-target', '#editor')
    .attr('aria-expanded', 'false')
    .attr('aria-controls', 'editor')
    .addClass('btn')
    .addClass('btn-primary')
    .addClass('btn-raised')
    .text('edit')
    .click(function() {
      $("#editorTitle").text("Edit strip " + id);
    })
    .appendTo(bg);

  $('<button/>')
    .attr('type', 'button')
    .addClass('btn')
    .addClass('btn-secondary')
    .addClass('material-icons')
    .text('refresh')
    .appendTo(bg);

  $('<button/>')
    .attr('type', 'button')
    .addClass('btn')
    .addClass('btn-secondary')
    .addClass('material-icons')
    .text('delete')
    .appendTo(bg);

  console.log('Registering database ref for strip ' + id);
  var dbRef = firebase.database().ref('strips/' + id);
  dbRef.on('value', nextModeUpdate, dbErrorCallback);
  var stripState = {
    id: id,
    stripElem: strip,
    dbRef: dbRef,
    nextMode: 'unknown',
    curMode: 'none',
  };
  allStrips[id] = stripState;
  
  return stripState;
}

// Callback invoked when strip's next mode has changed from the DB.
function nextModeUpdate(snapshot) {
  console.log('nextModeUpdate for key ' + snapshot.key);
  var stripid = snapshot.key;
  var nextMode = snapshot.val();
  var strip = allStrips[stripid];
  if (strip == null) {
    console.log('nextModeUpdate bailing out as strip is not known yet: ' + stripid);
    return;
  }
  var e = strip.stripElem;
  strip.nextMode = nextMode;
  var nme = $(e).find("#nextMode");
  nme.text(nextMode);
  console.log(strip.nextMode);
  console.log(strip.curMode);
  if (strip.nextMode != strip.curMode) {
    console.log('No match');
    $(e).find("#loader").show();
  } else {
    console.log('Match, hiding spinner');
    $(e).find("#loader").hide();
  }
  nme.effect('highlight');
}

// Set a given strip to the given value.
function setMode(stripid, value) {
  console.log('Setting mode of ' + stripid + ' to ' + value);
  var strip = allStrips[stripid];
  if (strip == null) {
    return;
  }

  // Write current state to the database.
  strip.dbRef.set(value)
    .then(function() {
      addLogEntry('set ' + strip.id + ' to ' + value);
      $('#' + stripid).val(value);
    })
    .catch(function(error) {
      showError($('#dberror'), error.message);
    });

  // Update UI with pending indicator.
//  var e = strip.stripElem;
//  $(e).find('#nextMode').text(value);
//  $(e).find('#nextMode').effect('highlight');
}

// Add a new log entry to the database.
function addLogEntry(text) {
  var logRef = firebase.database().ref('log/');
  var entry = logRef.push();
  entry.set({
    'date': new Date().toJSON(),
    'name': currentUser().displayName,
    'text': text,
  });

  if (FAKE_AUTH) {
    showLogEntry(new Date(), currentUser().displayName, text);
  }
}

// Callback invoked when new log entry hits the database.
function newLogEntry(snapshot, preChildKey) {
  clearError($('#dberror'));
  var entry = snapshot.val();
  showLogEntry(new Date(entry.date), entry.name, entry.text);
}

// Show a log entry.
function showLogEntry(date, name, text) {
  var container = $('#log');
  var line = $('<div/>').addClass('log-line').prependTo(container);

  // Log entry.
  var entry = $('<div/>').addClass('log-line-entry').appendTo(line);

  var m = new moment(date);
  var dateString = m.format("ddd, h:mmA");

  $('<span/>')
    .addClass("log-line-date")
    .text(dateString)
    .appendTo(entry);
  $('<span/>')
    .addClass("log-line-name")
    .text(name)
    .appendTo(entry);
  $('<span/>')
    .addClass("log-line-text")
    .text(text)
    .appendTo(entry);
  entry.effect('highlight');
}

function logout() {
  firebase.auth().signOut().then(function() {
    setup(); // Get back to initial state.
  }, function(error) {
    console.log('Problem logging out: ' + error.message);
  });
}

// Callback when signin complete.
firebase.auth().onAuthStateChanged(function(user) {
  setup();
});