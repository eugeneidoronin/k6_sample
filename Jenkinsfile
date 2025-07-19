pipeline {
  agent any

  stages {
    stage('Run k6 test') {
      steps {
        sh '''
        K6_PROMETHEUS_RW_SERVER_URL=http://ubuntu1.cat:30090/api/v1/write \\
        k6 run -o experimental-prometheus-rw \\
        ${params.test_file}
        '''
      }
    }
  }
}