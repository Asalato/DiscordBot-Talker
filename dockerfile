FROM amazonlinux:2023

RUN curl -sL https://rpm.nodesource.com/setup_22.x | bash -
RUN yum install nodejs -y

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

CMD [ "node", "server.js" ]
