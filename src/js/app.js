var app = {};

$(function() {

  // Initial places from which to build the observalbe array for the list.
  var initialPlacesData = [
    'South San Francisco BART Station',
    'Starbucks',
    'Trader Joe\'s',
    'Five Guys',
    'Paris Baguette'
  ];

  /**
   * Creates a Place object.
   * @param {string} name Name of location, to be used in search
   * on Places service.
   */
  var Place = function(name) {
    /**
     * The name of the place (i.e. Starbucks). Used to search on
     * the Places service.
     * @type {string}
     */
    this.name = name;

    /** The Places service Place ID.
        @type {string} */
    this.placeId = null;

    /** The Places types.
        @type {Array.<strings>} */
    this.types = null;

    /** Lat-Long position. {Lat: val, Lng: val}
        @type {Object} */
    this.position = null;

    /** Whether the Place is included in filtered results.
        @type {boolean} */
    this.filtered = ko.observable(true);
  };

  /**
   * Creates a ViewModel for Knockout.
   */
  var ViewModel = function() {
    var self = this;
    this.map = null;
    this.markers = {};

    this.filter = ko.observable('');

    // Build observable array of Places from initial data.
    this.places = ko.observableArray(
      initialPlacesData.map(function(name) {
          return new Place(name);
    }));

    this.filterList = function() {
      self.places().forEach(function(place) {
        var re = new RegExp(self.filter(), 'ig');
        place.filtered(re.test(place.name));
      });

      self.refreshMarkers();
    };

    this.initMap = function() {
      var mapOptions = {
        center: {lat: 37.6640317, lng: -122.445706},
        zoom: 14,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.TOP_RIGHT
        },
        streetViewControl: false
      };

      self.map = new google.maps.Map($('#map')[0], mapOptions);
      self.placesService = new google.maps.places.PlacesService(self.map);
      self.refreshMarkers();
    };

    app.initMap = this.initMap;

    this.addMarker = function(placeId, location) {
      var marker = new google.maps.Marker({
          map: self.map,
          place: {
            placeId: placeId,
            location: location
          }
        });

      self.markers[placeId] = marker;

    };

    this.refreshMarkers = function() {
      self.places().forEach(function(place) {
          if (!place.placeId) {
            var request = {
              location: self.map.getCenter(),
              radius: '500',
              query: place.name
            };

            self.placesService.textSearch(request, function(results, status) {
              if (status == google.maps.places.PlacesServiceStatus.OK) {
                self.addMarker(results[0].place_id, results[0].geometry.location)

                // Store data to our Places object so we don't have to requery.
                place.placeId = results[0].place_id;
                place.position = results[0].geometry.location;
                place.types = results[0].types;
              }
            });
          } else {
            self.markers[place.placeId].setVisible(place.filtered());
          }
      });


    };
  };


  ko.applyBindings(new ViewModel());

});
