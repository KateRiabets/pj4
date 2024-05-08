



function populateCountriesAndCities() {
    var countriesAndCities = JSON.parse(localStorage.getItem("countries_and_cities"));

    function createDatalist(options, id) {
        var datalist = document.createElement('datalist');
        datalist.id = id;
        options.forEach(optionValue => {
            var option = document.createElement('option');
            option.value = optionValue;
            datalist.appendChild(option);
        });
        return datalist;
    }

    function setupCountryCityFields(countryInput, cityInput) {
        function updateCountryDatalist() {
            var countries = countriesAndCities.map(item => item.country)
                                               .filter((value, index, self) => self.indexOf(value) === index);
            var datalistId = 'countryList' + new Date().getTime();
            var datalist = createDatalist(countries, datalistId);
            if (countryInput) {
                countryInput.setAttribute('list', datalistId);
                countryInput.parentNode.appendChild(datalist);
            }
        }

        function updateCityDatalist() {
            var selectedCountry = countryInput.value;
            var cities = countriesAndCities.find(item => item.country === selectedCountry)?.cities || [];
            var datalistId = 'cityList' + new Date().getTime();
            var datalist = createDatalist(cities, datalistId);
            if (cityInput) {
                cityInput.setAttribute('list', datalistId);
                cityInput.parentNode.appendChild(datalist);
            }
        }

        if (countryInput && cityInput) {
            updateCountryDatalist();
            countryInput.addEventListener('change', function() {
                cityInput.value = "";
                updateCityDatalist();
            });
        }
    }

    // Установка начальных полей
    document.querySelectorAll('.form-group2').forEach(group => {
        var countryInputs = group.querySelectorAll('.column input[placeholder="Країна"]');
        var cityInputs = group.querySelectorAll('.column input[placeholder="Місто"]');
        countryInputs.forEach((countryInput, index) => {
            if (cityInputs[index]) {
                setupCountryCityFields(countryInput, cityInputs[index]);
            }
        });
    });

    // Добавление новых полей
    document.querySelector('button[type="button"]').addEventListener('click', function() {
        var buttonParent = this.parentNode;
        var lastGroup = buttonParent.querySelector('.form-group2:last-of-type');
        var newGroup = lastGroup.cloneNode(true);

        newGroup.querySelectorAll('input').forEach(input => {
            input.value = ''; // Очищаем значения
            input.removeAttribute('list'); // Удаляем атрибут list для новых полей
        });

        var newCountryInputs = newGroup.querySelectorAll('.column input[placeholder="Країна"]');
        var newCityInputs = newGroup.querySelectorAll('.column input[placeholder="Місто"]');
        newCountryInputs.forEach((countryInput, index) => {
            if (newCityInputs[index]) {
                setupCountryCityFields(countryInput, newCityInputs[index]);
            }
        });

        // Вставляем новую группу перед кнопкой "+"
        buttonParent.insertBefore(newGroup, this);

        // Если есть необходимость, чтобы кнопка "+" была в самом конце, можно раскомментировать следующую строку:
        // buttonParent.appendChild(this); // Перемещаем кнопку "+" в конец родительского элемента
    });
}

populateCountriesAndCities();