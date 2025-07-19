pipeline {
  agent any

  stages {
    stage('Run k6 test') {
      steps {
        sh "k6 run ${params.test_file}"
      }
    }
  }
}