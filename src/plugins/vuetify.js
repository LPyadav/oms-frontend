import 'vuetify/styles'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'omsLight',
    themes: {
      omsLight: {
        dark: false,
        colors: {
          background: '#F6F8F6',
          surface: '#FFFFFF',
          primary: '#076A56',
          error: '#B3261E',
          'on-background': '#15332B',
          'on-surface': '#15332B',
          'on-primary': '#FFFFFF',
          'admin-navigation': '#102B24',
          'on-admin-navigation': '#F2FBF7',
        },
      },
    },
  },
})
