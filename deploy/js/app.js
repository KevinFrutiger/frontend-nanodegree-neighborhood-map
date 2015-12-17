var app={};$(function(){$filterMenu=$("#filter-menu"),$burgerButton=$("#burger-button"),$burgerButton.click(function(){$filterMenu.toggleClass("open")});var initialPlacesData=["South San Francisco BART Station","See's Candies","Trader Joe's","Five Guys","Paris Baguette","Starbucks","San Bruno Mountain State Park"],Place=function(name){this.name=name,this.placeId=null,this.types=null,this.position=null,this.isFiltered=ko.observable(!0),this.isSelected=ko.observable(!1),this.wikipediaData=""},ViewModel=function(){var self=this;this.map=null,this.markers={},this.infoWindow=null,this.markerAnimationTimeout=null,this.markerAnimationTimeoutDuration=3e3,this.filterString=ko.observable(""),initialPlacesData=initialPlacesData.sort(function(a,b){return a>b?1:b>a?-1:0}),this.places=ko.observableArray(initialPlacesData.map(function(name){return new Place(name)})),this.filterList=function(){self.infoWindow&&(self.infoWindow.close(),self.infoWindow=null),self.places().forEach(function(place){var re=new RegExp(self.filterString(),"ig");place.isFiltered(re.test(place.name)),self.toggleListItemSelection(null)}),self.refreshMarkers()},this.listItemClick=function(place){self.toggleListItemSelection(place),self.map.panTo(place.position);var marker=self.markers[place.placeId];self.toggleMarkerAnimation(marker),self.addInfoWindow(marker,place.placeId),$("#filter-menu").removeClass("open")},this.toggleListItemSelection=function(place){self.places().forEach(function(currentPlace){currentPlace.isSelected(currentPlace===place)})},this.getPlaceFromId=function(placeId){for(var i=0,len=self.places().length;len>i;i++)if(self.places()[i].placeId===placeId)return self.places()[i]},this.initMap=function(){var mapOptions={center:{lat:37.6640317,lng:-122.445706},zoom:14,mapTypeControlOptions:{position:google.maps.ControlPosition.TOP_RIGHT},streetViewControl:!1};self.map=new google.maps.Map($("#map")[0],mapOptions),self.placesService=new google.maps.places.PlacesService(self.map),self.refreshMarkers()},app.initMap=this.initMap,this.addMarker=function(placeId,location){var marker=new google.maps.Marker({map:self.map,place:{placeId:placeId,location:location},animation:google.maps.Animation.DROP});marker.addListener("click",function(){self.toggleListItemSelection(self.getPlaceFromId(placeId)),self.toggleMarkerAnimation(marker),self.addInfoWindow(marker,placeId)}),self.markers[placeId]=marker},this.toggleMarkerAnimation=function(markerToAnimate){for(var key in self.markers){var marker=self.markers[key];marker!==markerToAnimate||marker.getAnimation()?marker.setAnimation(null):(marker.setAnimation(google.maps.Animation.BOUNCE),self.markerAnimationTimeout=setTimeout(self.createAnimationTimeoutHandler(marker),self.markerAnimationTimeoutDuration))}},this.createAnimationTimeoutHandler=function(currentMarker){return function(){currentMarker.setAnimation(null)}},this.addInfoWindow=function(marker,placeId){self.infoWindow&&(google.maps.event.clearListeners(self.infoWindow,"closeclick"),self.infoWindow.close());var place=self.getPlaceFromId(placeId),contentElement=document.createElement("div");contentElement.className="info-window-content";var infoHeaderElement=document.createElement("div");infoHeaderElement.className="info-window-heading",infoHeaderElement.appendChild(document.createTextNode(place.name));var statusElement=document.createElement("div");statusElement.className="info-status",statusElement.appendChild(document.createTextNode("Getting more information...")),contentElement.appendChild(infoHeaderElement),contentElement.appendChild(statusElement);var infoWindowOptions={content:contentElement};self.infoWindow=new google.maps.InfoWindow(infoWindowOptions),self.infoWindow.addListener("closeclick",function(){marker.setAnimation(null),self.infoWindow=null}),self.infoWindow.addListener("domready",function(){google.maps.event.clearListeners(self.infoWindow,"domready"),self.populateInfoWindow(place)}),self.infoWindow.open(self.map,marker)},this.populateInfoWindow=function(place){if(place.wikipediaData)self.appendInfo(place.wikipediaData);else{var wikiRequestTimeout=setTimeout(function(){},8e3),wikiUrl="https://en.wikipedia.org/w/api.php",settings={dataType:"jsonp",data:{action:"opensearch",search:place.name,format:"json",formatversion:2},success:function(data,status,jqXHR){clearTimeout(wikiRequestTimeout);var htmlString="";if(data[2][0]){var snippet=data[2][0],url=data[3][0],citation='<a href="'+url+'" target="_blank">Wikipedia</a>';htmlString="<blockquote>"+snippet+'</blockquote><cite class="info-window-citation">Source: '+citation+"</cite>"}else htmlString="<blockquote>No additional information available.<blockquote>";self.appendInfo(htmlString),place.wikipediaData=htmlString}};$.ajax(wikiUrl,settings)}},this.appendInfo=function(htmlString){var infoElement=self.infoWindow.getContent().cloneNode(!0),infoStr=infoElement.innerHTML;infoStr=infoStr.replace('<div class="info-status">Getting more information...</div>',""),infoStr+=htmlString,infoElement.innerHTML=infoStr,self.infoWindow.setContent(infoElement)},this.refreshMarkers=function(){self.places().forEach(function(place){if(place.placeId){var marker=self.markers[place.placeId];marker.setVisible(place.isFiltered()),null!==marker.getAnimation()&&marker.setAnimation(null)}else{var request={location:self.map.getCenter(),radius:"500",query:place.name};self.placesService.textSearch(request,function(results,status){status==google.maps.places.PlacesServiceStatus.OK&&(self.addMarker(results[0].place_id,results[0].geometry.location),place.placeId=results[0].place_id,place.position=results[0].geometry.location,place.types=results[0].types)})}})}};ko.applyBindings(new ViewModel)});