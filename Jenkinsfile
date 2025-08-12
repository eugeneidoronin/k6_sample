pipeline {
    agent {
        label 'common'
    }
    
    parameters {
        string(name: 'test_file', defaultValue: 'wp-sample-page.js', description: 'The k6 test file to run')
        choice(name: 'output_destination', choices: ['prometheus', 'influxdb', 'html'], description: 'Where to store test results')
        string(name: 'vus', defaultValue: '', description: 'Number of virtual users (optional, uses test file defaults if empty)')
        string(name: 'duration', defaultValue: '', description: 'Test duration (optional, uses test file defaults if empty)')
        booleanParam(name: 'debug', defaultValue: false, description: 'Enable debug output')
        booleanParam(name: 'run_ui_scenario', defaultValue: false, description: 'Run UI browser scenario')
        string(name: 'simple_form_vus', defaultValue: '10', description: 'Number of VUs for the simpleForm scenario')
        string(name: 'simple_form_iterations', defaultValue: '20', description: 'Number of iterations for the simpleForm scenario')
        string(name: 'sample_page_rate', defaultValue: '2', description: 'Request rate per second for the samplePage scenario')
        string(name: 'sample_page_duration', defaultValue: '2m', description: 'Duration for the samplePage scenario')
        string(name: 'ui_iterations', defaultValue: '15', description: 'Number of iterations for the UI scenario (if enabled)')
    }

    environment {
        // Prometheus settings
        PROMETHEUS_URL = 'http://prometheus.ubuntu1.cat/api/v1/write'

        // InfluxDB settings
        INFLUXDB_ORG = 'ZORG'
        INFLUXDB_BUCKET = 'k6'
        INFLUXDB_ADDR = 'http://influxdb.ubuntu1.cat/'
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

                    // Create environment variables for scenario configuration
                    def scenarioEnv = """
                    K6_SCENARIO_SIMPLE_FORM_VUS=${params.simple_form_vus} \\
                    K6_SCENARIO_SIMPLE_FORM_ITERATIONS=${params.simple_form_iterations} \\
                    K6_SCENARIO_SAMPLE_PAGE_RATE=${params.sample_page_rate} \\
                    K6_SCENARIO_SAMPLE_PAGE_DURATION=${params.sample_page_duration} \\
                    K6_SCENARIO_UI_ENABLED=${params.run_ui_scenario} \\
                    K6_SCENARIO_UI_ITERATIONS=${params.ui_iterations} \\
                    """

                    // Run with different output based on parameter
                    switch(params.output_destination) {
                        case 'prometheus':
                            sh """
                            ${scenarioEnv}
                            K6_PROMETHEUS_RW_SERVER_URL=${env.PROMETHEUS_URL} \\
                            k6 run -o experimental-prometheus-rw ${options} \\
                            ${params.test_file}
                            """
                            break

                        case 'influxdb':
                            sh """
                            ${scenarioEnv}
                            K6_INFLUXDB_ORGANIZATION="${env.INFLUXDB_ORG}" \\
                            K6_INFLUXDB_BUCKET="${env.INFLUXDB_BUCKET}" \\
                            K6_INFLUXDB_TOKEN="${env.INFLUXDB_TOKEN}" \\
                            K6_INFLUXDB_ADDR="${env.INFLUXDB_ADDR}" \\
                            k6 run -o xk6-influxdb ${options} \\
                            ${params.test_file}
                            """
                            break

                        case 'html':
                            // Create results directory if it doesn't exist
                            sh "mkdir -p test-results"

                            sh """
                            ${scenarioEnv}
                            K6_WEB_DASHBOARD=true \\
                            K6_WEB_DASHBOARD_EXPORT=test-results/html-report.html \\
                            k6 run ${options} \\
                            ${params.test_file}
                            """
                            break
                    }
                }
            }
        }

        stage('Archive Results') {
            when {
                expression { params.output_destination == 'html' }
            }
            steps {
                archiveArtifacts artifacts: 'test-results/**', allowEmptyArchive: true

                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'test-results',
                    reportFiles: 'html-report.html',
                    reportName: 'K6 Test Results'
                ])
            }
        }

        stage('Workspace Cleanup'){
            steps {
                script {
                    // Log status messages based on build result
                    if (currentBuild.currentResult == 'SUCCESS') {
                        echo "K6 tests completed successfully for ${params.test_file}"
                    } else {
                        echo "K6 tests failed for ${params.test_file}"
                    }

                    // Clean workspace
                    cleanWs(
                        patterns: [[pattern: '**/node_modules/**', type: 'INCLUDE'],
                                  [pattern: '**/.git/**', type: 'INCLUDE']],
                        deleteDirs: true,
                        disableDeferredWipeout: true,
                        notFailBuild: true
                    )
                }
            }
        }
    }
}