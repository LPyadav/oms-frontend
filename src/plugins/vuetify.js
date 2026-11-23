import 'vuetify/styles'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'omsDark',
    themes: {
      omsDark: {
        dark: true,
        colors: {
          background: '#0A101A',
          surface: '#181F2C',
          'surface-variant': '#263142',
          primary: '#FFC77E',
          success: '#76DEAB',
          warning: '#FFD18E',
          info: '#A9C6FF',
          error: '#FFB4AB',
          'on-background': '#F7F4EF',
          'on-surface': '#F7F4EF',
          'on-surface-variant': '#BEC8D8',
          'on-primary': '#24160C',
          'on-success': '#0D2B1D',
          'on-warning': '#34200B',
          'on-info': '#15243B',
          'on-error': '#390B08',
          'admin-navigation': '#101723',
          'on-admin-navigation': '#F7F4EF',
        },
      },
    },
  },
})
