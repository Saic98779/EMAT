pipeline {
    agent any

    environment {
        DEPLOY_DIR = '/var/www/html/emat'
    }

    stages {

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build React App') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    rm -rf ${DEPLOY_DIR}/*
                    cp -r dist/* ${DEPLOY_DIR}/
                '''
            }
        }
    }

    post {
        success {
            echo 'EMAT frontend deployed successfully!'
        }

        failure {
            echo 'EMAT frontend deployment failed!'
        }
    }
}