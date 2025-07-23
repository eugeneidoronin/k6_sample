pipeline {
    agent any
    
    parameters {
        string(name: 'test_file', defaultValue: 'wp-sample-page.js', description: 'The k6 test file to run')
        choice(name: 'output_destination', choices: ['prometheus', 'influxdb', 'json'], description: 'Where to store test results')
        string(name: 'vus', defaultValue: '', description: 'Number of virtual users (optional, uses test file defaults if empty)')
        string(name: 'duration', defaultValue: '', description: 'Test duration (optional, uses test file defaults if empty)')
        booleanParam(name: 'debug', defaultValue: false, description: 'Enable debug output')
    }
    
    environment {
        // Prometheus settings
        PROMETHEUS_URL = 'http://ubuntu1.cat:30090/api/v1/write'
        
        // InfluxDB settings
        INFLUXDB_ORG = 'ZORG'
        INFLUXDB_BUCKET = 'k6'
        INFLUXDB_ADDR = 'http://ubuntu1.cat:32223/'
        // Store this as a credential in Jenkins
        INFLUXDB_TOKEN = credentials('influxdb-token')
    }
    
    stages {
        stage('Validate Test File') {
            steps {
                // Check if test file exists and is valid
                script {
                    def fileExists = sh(script: "test -f ${params.test_file}", returnStatus: true)
                    if (fileExists != 0) {
                        error "Test file ${params.test_file} does not exist!"
                    }
                    
                    if (params.debug) {
                        sh "k6 inspect ${params.test_file}"
                    }
                }
            }
        }
        
        stage('Run k6 Test') {
            steps {
                script {
                    def options = ""
                    
                    // Add VUs parameter if provided
                    if (params.vus?.trim()) {
                        options += " --vus ${params.vus}"
                    }
                    
                    // Add duration parameter if provided
                    if (params.duration?.trim()) {
                        options += " --duration ${params.duration}"
                    }
                    
                    // Run with different output based on parameter
                    switch(params.output_destination) {
                        case 'prometheus':
                            sh """
                            K6_PROMETHEUS_RW_SERVER_URL=${env.PROMETHEUS_URL} \\
                            k6 run -o experimental-prometheus-rw ${options} \\
                            ${params.test_file}
                            """
                            break
                            
                        case 'influxdb':
                            sh """
                            K6_INFLUXDB_ORGANIZATION="${env.INFLUXDB_ORG}" \\
                            K6_INFLUXDB_BUCKET="${env.INFLUXDB_BUCKET}" \\
                            K6_INFLUXDB_TOKEN="${env.INFLUXDB_TOKEN}" \\
                            K6_INFLUXDB_ADDR="${env.INFLUXDB_ADDR}" \\
                            k6 run -o xk6-influxdb ${options} \\
                            ${params.test_file}
                            """
                            break
                            
                        case 'json':
                            // Create results directory if it doesn't exist
                            sh "mkdir -p test-results"
                            
                            sh """
                            k6 run -o json=test-results/results.json ${options} \\
                            ${params.test_file}
                            """
                            break
                    }
                }
            }
        }
        
        stage('Archive Results') {
            when {
                expression { params.output_destination == 'json' }
            }
            steps {
                archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true
                
                // Generate a simple HTML report from JSON data
                sh '''
                echo '<html><head><title>K6 Test Results</title></head><body>' > test-results/summary.html
                echo '<h1>K6 Test Results Summary</h1>' >> test-results/summary.html
                echo '<pre>' >> test-results/summary.html
                cat test-results/results.json | grep -E 'checks|http_req_duration|vus|iterations' >> test-results/summary.html
                echo '</pre></body></html>' >> test-results/summary.html
                '''
                
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'test-results',
                    reportFiles: 'summary.html',
                    reportName: 'K6 Test Results'
                ])
            }
        }
    }
    
    post {
        always {
            node('any') {
                    cleanWs(
                        patterns: [[pattern: '**/node_modules/**', type: 'INCLUDE'],
                                   [pattern: '**/.git/**', type: 'INCLUDE']],
                        deleteDirs: true,
                        disableDeferredWipeout: true,
                        notFailBuild: true
                    )
                }
        }
        success {
            echo "K6 tests completed successfully for ${params.test_file}"
        }
        failure {
            echo "K6 tests failed for ${params.test_file}"
        }
    }
}