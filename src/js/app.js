var app = {};

$(function() {

  var initialLocationsData = [
    {
      name: 'South San Francisco BART Station',
      type: 'transit',
      position: {lat: 37.6640317, lng: -122.445706}
    },
    {
      name: 'Starbucks',
      type: 'coffee',
      position: {lat: 37.6629385, lng: -122.4471415}
    }
  ];

  // TODO: Set up Knockout

  app.initMap = function() {
    var mapOptions = {
        center: {lat: 37.6640317, lng: -122.445706},
        zoom: 14,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT
        },
        streetViewControl: false
    };

    app.map = new google.maps.Map($('#map')[0], mapOptions);
  };

});