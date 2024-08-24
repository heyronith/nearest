let map, userMarker;
const API_KEY = 'fsq3IZII1s3WFZM3S0RiaElc5/8KN+DVrARGuYnD/7XvZuQ='; // Replace with your actual API key

function init() {
    initMap();
    getUserLocation();
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
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function getUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            updateMap(position.coords.latitude, position.coords.longitude, "Your Location");
        }, function(error) {
            console.error("Geolocation error:", error);
            alert("Unable to get your location. Please enter a location manually.");
        });
    } else {
        alert("Geolocation is not supported by this browser. Please enter a location manually.");
    }
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
    map.setView([lat, lon], 13);
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    userMarker = L.marker([lat, lon]).addTo(map).bindPopup(popupText).openPopup();
}

function findPlaces(includeRating) {
    if (!userMarker) {
        alert("Please set a location first.");
        return;
    }

    const category = document.getElementById('category').value;
    const lat = userMarker.getLatLng().lat;
    const lng = userMarker.getLatLng().lng;

    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        alert("Invalid coordinates. Please try setting your location again.");
        return;
    }

    if (!['restaurant', 'cafe', 'bar'].includes(category)) {
        alert("Invalid category. Please select a valid category from the dropdown.");
        return;
    }

    const limit = includeRating ? 15 : 5;

    const url = `https://api.foursquare.com/v3/places/search?query=${category}&ll=${lat},${lng}&sort=DISTANCE&limit=${limit}&fields=name,geocodes,rating`;

    console.log('Request URL:', url);
    console.log('API Key used:', API_KEY.substring(0, 6) + '...');

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
        console.log('Received data:', data);
        if (!data.results || data.results.length === 0) {
            throw new Error('No results found');
        }

        let places = data.results.map(place => ({
            name: place.name,
            lat: place.geocodes.main.latitude,
            lng: place.geocodes.main.longitude,
            rating: place.rating ? place.rating / 2 : null,
            distance: distance(userMarker.getLatLng(), L.latLng(place.geocodes.main.latitude, place.geocodes.main.longitude))
        }));

        console.log('Processed places:', places);

        if (includeRating) {
            places = places.filter(place => place.rating !== null);
            places.sort((a, b) => (b.rating / b.distance) - (a.rating / a.distance));
        } else {
            places.sort((a, b) => a.distance - b.distance);
        }

        places = places.slice(0, 3);
        console.log('Final places to display:', places);

        if (places.length === 0) {
            throw new Error('No places to display after filtering');
        }

        displayResults(places, includeRating);
    })
    .catch(error => {
        console.error('Error details:', error);
        alert('An error occurred while fetching places: ' + error.message);
    });
}

function displayResults(places, includeRating) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    map.eachLayer((layer) => {
        if(layer !== userMarker && !(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });

    places.forEach((place, index) => {
        L.marker([place.lat, place.lng]).addTo(map)
            .bindPopup(`<strong>${place.name}</strong><br>Rating: ${place.rating ? place.rating.toFixed(1) : 'N/A'}`);

        const placeElement = document.createElement('div');
        placeElement.className = 'result-item';
        placeElement.innerHTML = `
            <h3>${index + 1}. ${place.name}</h3>
            <p>Rating: ${place.rating ? place.rating.toFixed(1) : 'Not Available'}</p>
            <p>Distance: ${place.distance.toFixed(2)} km</p>
        `;
        resultsDiv.appendChild(placeElement);
    });

    if (places.length === 0) {
        resultsDiv.innerHTML = '<p>No places found. Try a different location or category.</p>';
    }
}

function distance(latlng1, latlng2) {
    return (latlng1.distanceTo(latlng2) / 1000); // Convert meters to kilometers
}

window.onload = init;
