let map, userMarker;
const API_KEY = 'fsq31HBm6WcAeXBn0EXKzX+1TV9Iq4xpQ11LXokWZ+CzsKI='; // Replace with your actual API key

function init() {
    document.getElementById('nearest-btn').addEventListener('click', () => findPlaces(false));
    document.getElementById('nearest-rated-btn').addEventListener('click', () => findPlaces(true));
    document.getElementById('search-btn').addEventListener('click', searchLocation);
    document.getElementById('location-search').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchLocation();
        }
    });
}

function initMap() {
    if (!map) {
        map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    }
    document.getElementById('map-container').style.height = '400px';
}

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function(position) {
                resolve({lat: position.coords.latitude, lng: position.coords.longitude});
            }, function(error) {
                reject("Unable to get your location. Please enter a location manually.");
            });
        } else {
            reject("Geolocation is not supported by this browser. Please enter a location manually.");
        }
    });
}

function searchLocation() {
    const query = document.getElementById('location-search').value;
    if (!query) {
        alert("Please enter a location to search.");
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                updateMap(data[0].lat, data[0].lon, data[0].display_name);
            } else {
                alert("Location not found. Please try a different search term.");
            }
        })
        .catch(error => {
            console.error('Location search error:', error);
            alert("An error occurred while searching for the location. Please try again.");
        });
}

function updateMap(lat, lon, popupText) {
    initMap();
    map.setView([lat, lon], 13);
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    userMarker = L.marker([lat, lon]).addTo(map).bindPopup(popupText).openPopup();
}

function findPlaces(includeRating) {
    if (!userMarker) {
        getUserLocation()
            .then(coords => {
                updateMap(coords.lat, coords.lng, "Your Location");
                fetchPlaces(coords.lat, coords.lng, includeRating);
            })
            .catch(error => {
                alert(error);
            });
    } else {
        const lat = userMarker.getLatLng().lat;
        const lng = userMarker.getLatLng().lng;
        fetchPlaces(lat, lng, includeRating);
    }
}

function fetchPlaces(lat, lng, includeRating) {
    const category = document.getElementById('category').value;
    const limit = includeRating ? 15 : 5;

    const url = `https://api.foursquare.com/v3/places/search?query=${category}&ll=${lat},${lng}&sort=DISTANCE&limit=${limit}&fields=name,geocodes,rating`;

    fetch(url, {
        headers: {
            'Authorization': API_KEY
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
            });
        }
        return response.json();
    })
    .then(data => {
        if (!data.results || data.results.length === 0) {
            throw new Error('No results found');
        }

        let places = data.results.map(place => ({
            name: place.name,
            lat: place.geocodes.main.latitude,
            lng: place.geocodes.main.longitude,
            rating: place.rating ? place.rating / 2 : null,
            distance: distance({lat, lng}, {lat: place.geocodes.main.latitude, lng: place.geocodes.main.longitude})
        }));

        if (includeRating) {
            places = places.filter(place => place.rating !== null);
            places.sort((a, b) => (b.rating / b.distance) - (a.rating / a.distance));
        } else {
            places.sort((a, b) => a.distance - b.distance);
        }

        places = places.slice(0, 3);
        displayResults(places, {lat, lng});
    })
    .catch(error => {
        console.error('Error details:', error);
        alert('An error occurred while fetching places: ' + error.message);
    });
}

function displayResults(places, userLocation) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    map.eachLayer((layer) => {
        if(layer !== userMarker && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    places.forEach((place, index) => {
        const marker = L.marker([place.lat, place.lng]).addTo(map)
            .bindPopup(`<strong>${place.name}</strong><br>Rating: ${place.rating ? place.rating.toFixed(1) : 'N/A'}`);

        const placeElement = document.createElement('div');
        placeElement.className = 'result-item';
        placeElement.innerHTML = `
            <h3>${index + 1}. ${place.name}</h3>
            <div class="result-details">
                <p>Rating: ${place.rating ? place.rating.toFixed(1) : 'Not Available'}</p>
                <p>Distance: ${place.distance.toFixed(2)} km</p>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${place.lat},${place.lng}" target="_blank" class="directions-link">
                    <i class="fas fa-directions"></i> Get Directions
                </a>
            </div>
        `;

        placeElement.addEventListener('click', function() {
            this.querySelector('.result-details').style.display = 
                this.querySelector('.result-details').style.display === 'none' ? 'block' : 'none';
            map.setView([place.lat, place.lng], 15);
            marker.openPopup();
        });

        resultsDiv.appendChild(placeElement);
    });

    if (places.length === 0) {
        resultsDiv.innerHTML = '<p>No places found. Try a different location or category.</p>';
    }
}

function distance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

window.onload = init;
