'use strict';

angular
    .module('App')
    .constant('APP_SETTING', {
        LANGUAGES: [
            {
                locale: 'en',
                name: 'English',
            },
            {
                locale: 'es',
                name: 'Español',
            },
        ]
    });
