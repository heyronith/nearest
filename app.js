mapboxgl.accessToken = 'pk.eyJ1Ijoicm9uaXRoc2hhcm1pbGEiLCJhIjoiY20wYnN0OWp2MGFhdTJrcHhtMDlzYTBkeiJ9.0FB0MmTbjbT-KNOcqvZXgg';
const GOOGLE_API_KEY = 'AIzaSyBWZA7Nj_h6bPm2CcclxdhWpbyeAReh6tg';
let map, userMarker;

function init() {
    try {
        initMap();
        document.getElementById('nearest-btn').addEventListener('click', () => findPlaces(false));
        document.getElementById('nearest-rated-btn').addEventListener('click', () => findPlaces(true));
    } catch (error) {
        console.error('Initialization error:', error);
        alert('An error occurred during initialization: ' + error.message);
    }
}

function initMap() {
    try {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [-74.5, 40], // Default to New York
            zoom: 9
        });

        const geocoder = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            countries: 'us'
        });

        document.getElementById('geocoder').appendChild(geocoder.onAdd(map));

        map.on('load', function() {
            getUserLocation();
        });

        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Map initialization error:', error);
        alert('An error occurred while initializing the map: ' + error.message);
    }
}

function getUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = [position.coords.longitude, position.coords.latitude];
                map.flyTo({center: userLocation, zoom: 13});
                updateUserMarker(userLocation);
            },
            (error) => {
                console.error('Geolocation error:', error);
            }
        );
    } else {
        console.error('Geolocation is not supported by this browser.');
    }
}

function updateUserMarker(location) {
    if (userMarker) userMarker.remove();
    userMarker = new mapboxgl.Marker().setLngLat(location).addTo(map);
}

function findPlaces(includeRating) {
    const category = document.getElementById('category').value;
    const center = map.getCenter();
    
    console.log('Searching for:', category);
    console.log('Center:', center);

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${category}.json?types=poi&proximity=${center.lng},${center.lat}&access_token=${mapboxgl.accessToken}`;
    
    console.log('Fetching from URL:', url);

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('API response:', data);
            
            if (!data.features || data.features.length === 0) {
                throw new Error('No places found');
            }

            let places = data.features.map(place => ({
                name: place.text,
                lng: place.center[0],
                lat: place.center[1],
                distance: turf.distance(
                    turf.point([center.lng, center.lat]),
                    turf.point(place.center),
                    {units: 'kilometers'}
                )
            }));

            console.log('Processed places:', places);

            return Promise.all(places.map(place => getGooglePlaceDetails(place)));
        })
        .then(placesWithDetails => {
            if (includeRating) {
                placesWithDetails.sort((a, b) => (b.rating / b.distance) - (a.rating / a.distance));
            } else {
                placesWithDetails.sort((a, b) => a.distance - b.distance);
            }

            displayResults(placesWithDetails.slice(0, 3));
        })
        .catch(error => {
            console.error('Error details:', error);
            alert('An error occurred while fetching places: ' + error.message);
        });
}

function getGooglePlaceDetails(place) {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(place.name)}&inputtype=textquery&fields=rating,user_ratings_total&key=${GOOGLE_API_KEY}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.candidates && data.candidates.length > 0) {
                place.rating = data.candidates[0].rating || 'N/A';
                place.reviewCount = data.candidates[0].user_ratings_total || 0;
            } else {
                place.rating = 'N/A';
                place.reviewCount = 0;
            }
            return place;
        })
        .catch(error => {
            console.error('Error fetching Google Place details:', error);
            place.rating = 'N/A';
            place.reviewCount = 0;
            return place;
        });
}

function displayResults(places) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    // Clear previous markers
    map.markers?.forEach(marker => marker.remove());
    map.markers = [];

    places.forEach((place, index) => {
        const marker = new mapboxgl.Marker()
            .setLngLat([place.lng, place.lat])
            .addTo(map);

        map.markers.push(marker);

        const placeElement = document.createElement('div');
        placeElement.className = 'result-item';
        placeElement.innerHTML = `
            <h3>${index + 1}. ${place.name}</h3>
            <div class="result-details">
                <p>Distance: ${place.distance.toFixed(2)} km</p>
                <p>Rating: ${place.rating} (${place.reviewCount} reviews)</p>
                <p><small>Ratings and reviews provided by Google Places API.</small></p>
            </div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}" target="_blank" class="directions-icon" title="Get Directions">
                <i class="fas fa-directions"></i>
            </a>
        `;

        placeElement.addEventListener('click', function() {
            this.classList.toggle('active');
            map.flyTo({center: [place.lng, place.lat], zoom: 15});
        });

        resultsDiv.appendChild(placeElement);
    });
}

window.onload = init;
